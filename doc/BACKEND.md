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
