# 后端通信改造方案

当前是 **namespace + 静态数据** 范式（`GameData` 编译期写死剧情）。
改造成后端通信的核心：**数据来源从"编译期对象"换成"运行时网络下发"**，
类型契约（`StoryNode` 接口）不变，前后端共用同一份 JSON 结构。

## 1. 涉及文件

```
src/wuxia/net/ApiClient.ts     网络层（Laya.HttpRequest → Promise）
src/wuxia/net/StorySource.ts   剧情数据源（远程优先 + 本地兜底 + 缓存）
src/wuxia/system/StorySystem.ts enter() 改为异步加载
src/Main.ts                    后端开关（一行注释切换）
server/server.js               Node 后端示例（零依赖）
```

## 2. 网络层 ApiClient

基于引擎自带的 `Laya.HttpRequest`，Promise 化：

```ts
static baseUrl = "";   // 空 = 离线模式；赋值 = 后端通信

static get<T>(path: string, timeout = 8000): Promise<T> {
    return this.request<T>("get", path, null, timeout);
}
static post<T>(path: string, data: unknown, timeout = 8000): Promise<T> {
    return this.request<T>("post", path, data, timeout);
}
```

- `responseType="json"`，COMPLETE 回调直接拿到解析后的对象
- 内置 8s 超时，防止请求悬挂
- `baseUrl` 为空串时 `ApiClient.online === false`，走纯离线分支

## 3. 数据源 StorySource

远程优先、失败回退本地、带内存缓存、并发去重：

```ts
static get(id: string): Promise<StoryNode | null> {
    if (this.cache[id]) return Promise.resolve(this.cache[id]);
    if (this.loading[id]) return this.loading[id];   // 并发去重
    const p = ApiClient.online
        ? this.fromRemote(id)                        // 后端 → 拉远端
        : Promise.resolve(this.fromLocal(id));       // 离线 → 读本地
    ...
}

private static fromRemote(id: string): Promise<StoryNode | null> {
    return ApiClient.get<StoryNode>("/api/story/" + encodeURIComponent(id))
        .then((node) => { this.cache[id] = node; return node; })
        .catch((err) => { console.warn(...); return this.fromLocal(id); });  // 兜底
}
```

## 4. 改造点（StorySystem.enter）

只改一处，外部调用零改动：

```ts
enter(nodeId: string): void {
    StorySource.get(nodeId).then((node) => {
        if (!node) { this.ui.log(`[错误] 剧情节点不存在：${nodeId}`, "#ff5555"); return; }
        this.hero.currentNode = nodeId;
        this.ui.log("────────────────────────", "#6a6a6a");
        this.ui.log(node.text, "#e8e0cc");
        this.applyEffects(node.effect || []);
        if (this.pendingNode) return;   // 战斗效果已挂起
        this.showChoices(node);
    });
}
```

## 5. 后端服务示例

`server/server.js`（Node 原生 http，零第三方依赖）：

```
启动: npm run server        (默认端口 3000)

GET  /api/story            → 全部剧情节点
GET  /api/story/:id        → 单个节点（符合 StoryNode 结构，模拟 100ms 延迟）
POST /api/save             → 接收存档（示例仅打印，可接数据库）
GET  /api/hero/:name       → 读取远端存档（示例返回 404 = 无）
其他路径                    → 静态托管 dist/
```

已带 CORS 头（`Access-Control-Allow-Origin: *`），前端 8000、后端 3000 可跨域互通。

## 6. 启用方式

```bash
npm run server          # 启动后端 http://localhost:3000
```

`src/Main.ts` 放开一行注释：

```ts
// WuXia.ApiClient.baseUrl = "http://localhost:3000/api";
```

重新 `npm run build` 刷新页面。远端剧情节点的文本带 **【远端数据】标记**，
可确认数据来自服务器；关闭后端后刷新，自动回退本地 `GameData`，游戏照常可玩。

## 7. 扩展方向

- **存档上云**：`POST /api/save` 已留好，把 `SaveManager` 读写接到 `ApiClient`
- **账号体系**：请求头带 token，后端按玩家隔离存档
- **数据驱动运营**：剧情/武功/掉落放数据库，改配置无需发版；
  配版本号 + `StorySource.clearCache()` 即可热更新
- **多玩法接口**：排行榜、邮件、商城等按 `/api/*` 路由扩展

## 8. 异步请求机制：挂起与唤醒

`this.request<T>("get", path, null, timeout)` 是"挂起 + 唤醒"式异步调用。
**挂起的不是线程**——JS 是单线程事件循环模型，真正等网络的是浏览器内核的
异步 I/O；数据回来时通过 **事件 + 回调** 把执行权"唤醒"回来。

### 8.1 完整链路

**第 1 步：发起请求，立刻返回（不阻塞）**

`request<T>()` 创建 Promise，内部 new 一个 `Laya.HttpRequest` 并调用 `send()`。
引擎 `send()` 的关键点（`engine/.../laya.core.js`）：

```js
http.open(method, url, true);            // true = 异步模式，send() 立即返回
http.onload   = e => this._onLoad(e);    // 注册 onload 回调
http.send(data);                         // 发出请求后立即返回，不阻塞
```

`open(..., true)` 的 `true` 是**异步标志**——`send()` 立即返回，JS 线程继续跑
下面的代码，**不阻塞**。真正的网络收发在浏览器内核的 I/O 线程进行。

此时 Promise 处于 `pending` 状态，`resolve`/`reject` 保存在闭包里等待将来被调用
——这就是"挂起"。

**第 2 步：数据回来，引擎派发事件**

```js
_onLoad(e) {
    var status = this._http.status;
    if (status === 200 || status === 204 || status === 0) {
        this.complete();                  // 成功 → 解析数据
    } else {
        this.error(...);                  // 非 2xx → 触发 ERROR
    }
}
complete() {
    if (this._responseType === "json") {
        this._data = JSON.parse(this._http.responseText);  // "json" 自动解析
    }
    this.event(Event.COMPLETE, this._data);  // 派发 COMPLETE 事件，携带数据
}
```

**第 3 步：回调被唤醒**

`ApiClient` 中注册的监听是"唤醒开关"：

```ts
http.once(Laya.Event.COMPLETE, this, (res: unknown) => {
    settled = true;
    clearTimeout(timer);
    resolve(res as T);        // 唤醒：Promise 从 pending 变 fulfilled
});
```

`resolve(res)` **不会同步执行**后续代码，而是把 `.then()` 回调放进**微任务队列**，
当前任务执行完后由事件循环取出执行。

**第 4 步：调用方继续**

```ts
StorySource.get(nodeId).then((node) => { ... showChoices(node) });
```

Promise 变为 fulfilled 后 `.then` 回调执行——调用方的代码"从挂起处被唤醒"，
拿到 `node` 继续渲染界面。

### 8.2 时序图

```
调用方                  request()               HttpRequest(XHR)        浏览器内核
  │                        │                        │                      │
  ├─ 创建 Promise ─────────►   send() ──────────────►  open(true)+send() ──► 网络收发
  │                        │                        │                      │  (后台进行)
  ├─ 继续执行其他代码 ◄─────┘ (立即返回,不阻塞)        │                      │
  │   ...空闲...                                    │                      │
  │                        │                      ◄──── onload 触发 ────────┤
  │                        │                _onLoad → complete()            │
  │                        │                JSON.parse + 派发 COMPLETE       │
  │                        │                        │                      │
  │  resolve(data) ◄───────┼─── once 回调被调用 ─────┤                      │
  │                        │                        │                      │
  ├─ .then 回调入微任务队列 │                        │                      │
  ├─ 事件循环取出微任务 ────► showChoices(node)       │                      │
```

### 8.3 三个关键认知

1. **"挂起"只是 Promise 停在 pending**：调用方函数早已返回，`request()` 之后的
   代码立即执行，不受网络影响。没有线程阻塞，不会卡死 UI。
2. **"唤醒"是事件 + 微任务**：网络数据到达 → `onload` → 引擎派发 COMPLETE →
   回调 `resolve()` → Promise 状态变更 → `.then()` 入微任务队列 → 事件循环执行。
   整条链都是**回调驱动**，JS 主线程全程没有被"占住"。
3. **超时兜底**：`ApiClient` 内置 8s `setTimeout`，未 `resolve`/`reject` 则手动
   `reject(new Error("请求超时"))`，防止网络卡死时 Promise 永远 pending。

补充：引擎 `HttpRequest` 内部复用同一个 `XMLHttpRequest` 实例，但每个 `request()`
调用都会 new 新的 `HttpRequest`，因此并发请求互不干扰——多个剧情节点可同时加载，
各自独立"挂起/唤醒"。
