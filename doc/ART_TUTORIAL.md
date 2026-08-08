# 美术资源接入教程

> 目标读者：要往本游戏加图片资源的人。
> 适用：把黑色底板换成背景图、加入主角/敌人形象图（立绘）、按钮换图等。
> 配套：`doc/FILE_GUIDE.md` §2.11（GameUI 布局说明）。

---

## 1. 原理：图片是怎么显示出来的

本游戏的界面全部是**代码绘制**（`GameUI.ts` 里的 `drawRect` 画色块），没有场景文件。要显示图片，只需：

1. 把图片文件放进 `bin/` 下（IDE 服务器根目录 = `bin/`，浏览器直接按相对 `bin/` 的路径访问）；
2. 在代码里创建一个 `Laya.Sprite`，给它加载图片纹理（`loadImage` / `load` + `texture`），设置位置与大小；
3. `stage.addChild(sprite)` 挂到界面上。

**核心 API（LayaAir 3.x，三种写法任选）**：

```ts
// 写法 A：最简单 —— Sprite.loadImage（路径相对 bin/）
const sp = new Laya.Sprite();
sp.loadImage("resources/bg.jpg");
sp.size(960, 640);
stage.addChild(sp);

// 写法 B：先异步加载纹理，再赋给 sprite
Laya.loader.load("resources/bg.jpg").then((tex: Laya.Texture) => {
    const sp = new Laya.Sprite();
    sp.texture = tex;
    sp.size(960, 640);
    stage.addChild(sp);
});

// 写法 C：Texture2D 加载（适合复用同一张图）
Laya.Texture2D.load("resources/bg.jpg").then((tex2d: Laya.Texture2D) => {
    const sp = new Laya.Sprite();
    sp.texture = tex2d;
    sp.size(960, 640);
    stage.addChild(sp);
});
```

推荐**写法 A**：代码最少，失败时该区域空白不影响游戏。

---

## 2. 资源放哪里、怎么命名

在 `bin/` 下新建目录（首次）并放入图片：

```
bin/
└── resources/                 # 所有美术资源放这里（相对 bin 的路径）
    ├── bg/                    # 背景图
    │   └── main_bg.jpg
    ├── portraits/             # 形象图（立绘）
    │   ├── hero.png
    │   └── enemy_山贼.png     # 建议用敌人 id 命名，方便代码映射
    └── ui/                    # UI 元素（按钮等）
        └── btn_normal.png
```

规范建议：
- 路径统一 `resources/xxx/yyy.png`，代码里就用这个字符串。
- 命名与数据 id 对齐（如敌人 `EnemyData.id` = `enemy_山贼` → 图片 `resources/portraits/enemy_山贼.png`）。
- 格式：背景用 `jpg`（体积小），立绘/图标用 `png`（可透明）。

> ⚠️ `bin/` 下的图片不需要 IDE 导入即可直接用（服务器根就是 bin）。不要放在 `src/` 里。

---

## 3. 实战一：把黑色底板换成背景图

**现状**（`GameUI.ts` 的 `build()` 开头）：

```ts
const bg = new Laya.Sprite();
bg.graphics.drawRect(0, 0, 960, 640, "#17171e");   // ← 这就是黑色底板
stage.addChild(bg);
```

**改成**：

```ts
const bg = new Laya.Sprite();
bg.loadImage("resources/bg/main_bg.jpg");  // 背景图，路径相对 bin/
bg.size(960, 640);                          // 铺满舞台
stage.addChild(bg);
```

效果：黑色底板变成你的背景图；上面的文字/按钮/日志区原样保留（它们都是后 addChild 的，盖在背景之上）。

**想让文字区域仍有深色底以保持可读性**：保留 `logView` 的背景（本来就是 `#101015` 半透明观感色块），或把日志区背景改成半透明：`logView.graphics.drawRect(..., "#101015cc")`（ARGB 十六进制带透明度）。

---

## 4. 实战二：加入主角 / 敌人形象图（立绘）

### 4.1 改 `Hero.ts` —— 给 UI 接口加一个方法

在 `IGameUI` 接口中加（让剧情/战斗系统能通知界面换图）：

```ts
export interface IGameUI {
    log(text: string, color?: string): void;
    showChoices(choices: { text: string; handler: () => void }[]): void;
    clearChoices(): void;
    refreshStatus(hero: Hero): void;
    setInputHint(hint: string): void;
    showPortrait(url: string | null): void;   // ★ 新增：显示/隐藏形象图
}
```

### 4.2 改 `GameUI.ts` —— 实现立绘区

在类里加一个成员，`build()` 里创建（例如放在日志区左侧、宽 260 的区域）：

```ts
private portrait!: Laya.Sprite;   // 立绘区

// build() 里加（在 logView 之前 addChild，让日志盖住它或不盖都行）：
this.portrait = new Laya.Sprite();
this.portrait.pos(20, 70);               // 位置（x, y）
this.portrait.size(260, 400);            // 显示区域大小
this.portrait.visible = false;           // 默认隐藏
stage.addChild(this.portrait);

// 实现接口方法（加载成功后自动按区域缩放显示）：
public showPortrait(url: string | null): void {
    if (!url) { this.portrait.visible = false; return; }
    this.portrait.loadImage(url);
    this.portrait.visible = true;
}
```

> 小技巧：`loadImage` 后图片按原尺寸显示；若图片尺寸和区域不一致，可在图片加载后设置 `sprite.size(w,h)`，或用 `sprite.scaleX/scaleY` 缩放。立绘建议图片本身做好尺寸（如 260x400）。

### 4.3 在剧情 / 战斗中触发换图

**战斗开始显示敌人立绘**（`BattleSystem.ts` 的 `start()` 里，`ui.log` 附近加）：

```ts
this.ui.showPortrait("resources/portraits/" + enemyId + ".png");
```

**战斗结束隐藏**（`endBattle()` 里）：

```ts
this.ui.showPortrait(null);
```

**剧情按节点换图**（`StorySystem.ts` 的 `enter()` 里，可选——给 `StoryNode` 加一个可选字段 `image?: string`，然后）：

```ts
// Hero.ts 的 StoryNode 增加：
// image?: string;   // 该节点要显示的形象图（相对 bin 的路径）

// StorySystem.enter() 里：
if (node.image) this.ui.showPortrait(node.image);
else this.ui.showPortrait(null);
```

这样每段剧情的文本旁就能显示对应的角色/场景图。

---

## 5. 实战三：按钮换图（可选进阶）

现状按钮是 `makeButton()` 里 `drawRect` 画的纯色块。想用图片按钮：

```ts
private makeButton(text: string, w: number, h: number, handler: () => void): Laya.Sprite {
    const btn = new Laya.Sprite();
    btn.size(w, h);
    btn.loadImage("resources/ui/btn_normal.png");   // 普通态底图
    // 悬停态换图（保持原有的 hover 逻辑）：
    btn.on(Laya.Event.MOUSE_OVER, btn, () => {
        btn.loadImage("resources/ui/btn_hover.png");
    });
    btn.on(Laya.Event.MOUSE_OUT, btn, () => {
        btn.loadImage("resources/ui/btn_normal.png");
    });
    // 文字 label 照旧 addChild……
    btn.on(Laya.Event.CLICK, this, handler);
    return btn;
}
```

---

## 6. 常见坑

1. **路径基准**：代码里写的是相对 `bin/` 的路径（`resources/...`），因为 IDE 服务器根目录是 `bin/`。不要写 `../`。
2. **文件不在**：`loadImage` 失败只会空白，不报错；先确认 `curl http://localhost:18090/resources/bg/main_bg.jpg` 能返回 200。
3. **不要改 `.meta`**：图片放进 bin 由 IDE 管理，一般无需 `.meta`；若 IDE 自动生成，提交进 git 即可。
4. **改动后**：改代码要回 IDE 点“运行”重新编译；只加图片不用重编译（服务器直接读 bin 下的文件）。
5. **单文件版 / file:// 打开**：浏览器 file 协议下 `loadImage` 本地图片会因跨域限制失败；单文件版打包需把图片转 base64 内联，或改用本地 http 服务器。
6. **打包发布（dist）**：`tools/package.js` 目前不拷贝资源，发布前需把 `bin/resources/` 一并拷进 `dist/`。

---

## 7. 完整示例：加一张敌人立绘全流程

1. 图片 `resources/portraits/enemy_山贼.png` 放进 `bin/resources/portraits/`。
2. 改 `Hero.ts`：`IGameUI` 加 `showPortrait(url: string | null): void;`。
3. 改 `GameUI.ts`：加 `portrait` 成员 + `build()` 里创建 + 实现 `showPortrait`。
4. 改 `BattleSystem.ts`：`start()` 里 `this.ui.showPortrait("resources/portraits/" + enemyId + ".png")`；`endBattle()` 里 `this.ui.showPortrait(null)`。
5. 回 IDE 点“运行”，开战（`testbattle`）即可看到立绘。
