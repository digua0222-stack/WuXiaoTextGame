# 美术资源接入方案

当前 UI 是**纯代码绘制**（`GameUI` 中用 `graphics.drawRect` 画底色/边框/按钮），
没有图片资源。引入美术有三条路径，按渐进程度排列。

## 方案 A：保留代码 UI，只换"皮肤"（最快，不动架构）

美术只是替换 `GameUI.ts` 里的填充色/边框色，接近美术配色规范：

```ts
// 现在：写死颜色
btn.graphics.drawRect(0, 0, w, h, "#3a3a4a");

// 之后：从皮肤配置取色
btn.graphics.drawRect(0, 0, w, h, this.skin.panelColor);
```

适合流程先跑通、美术还在制作期的情况。

## 方案 B：Sprite 加载图片替换绘制（美术资源到位后）

把"色块"换成"图"：

```ts
const bg = new Laya.Sprite();
bg.loadImage("resources/ui/panel_bg.png");   // 九宫格或整图
```

### 资源目录约定

```
resources/
├── ui/          # 界面九宫格、按钮、图标
│   ├── panel/   # 面板底图
│   ├── btn/     # 按钮三态（normal/hover/press）
│   └── icons/   # 物品、属性图标
├── role/        # 主角立绘、敌人立绘
├── scene/       # 场景背景（小镇、山林、武馆）
└── audio/       # BGM、音效
```

## 方案 C：LayaAir 3 官方 UI（Scene2D + UI 组件，长期路线）

LayaAir 3 完整项目有 `Scene2D`、`UIView`、`Button`、`Image` 等现成组件，
可在 LayaAir IDE 里**可视化拼 UI**，导出后代码加载：

```ts
Laya.Scene2D.load("ui/MainView.scene", Laya.Handler.create(this, (scene: Laya.Scene2D) => {
    this.root.addChild(scene);
}));
```

## 架构如何配合

系统层与 UI 层通过 `IGameUI` 接口解耦，接入美术**只需重写 `GameUI` 实现类**
（色块换图片、按钮换 `Laya.Button`），接口不变，`Game.ts` 一行不用改。
若要使用官方 UI 组件，让新实现类内部用 `Scene2D` 挂载即可。

## 落地顺序建议

1. **现在**：保持代码绘制，先确认美术风格（配色/字体/边框），改 `GameUI` 皮肤常量
2. **美术就绪**：方案 B，按上述目录放 `resources/`，替换 `GameUI` 实现
3. **界面复杂化**（背包/商店/任务面板）：升级到方案 C 的 LayaAir IDE 可视化 UI
