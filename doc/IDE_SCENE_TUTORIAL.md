# IDE 可视化场景编辑教程（含 bundle 产物说明）

> 适用版本：LayaAir 3.4.0 · 项目类型：2D · 纯代码启动模式
> 关联文档：[FILE_GUIDE.md](./FILE_GUIDE.md) · [ART_TUTORIAL.md](./ART_TUTORIAL.md)

## 背景

本项目为纯代码 2D 项目：

- `assets/` 目录为空，全项目无任何 `.scene` 场景文件
- 当前画面全部由 `src/scenes/GameUI.ts` 用 `drawRect` / `Label` 代码绘制
- `bin/index.html` 直接引引擎库 + bundle，不依赖 IDE 的 `$_main_` 启动机制

因此"在 IDE 中编辑资源"需从零开始：先创建场景，才能编辑。

## 目标

创建故事切换时的 **loading 界面**，并体验完整的 IDE 可视化资源流程。

## 步骤一：创建 2D 场景资源

在 IDE 资源面板中：

1. 右键 `assets/` → **创建 → 2D → 场景**，生成 `loading.scene`
2. 双击打开，进入**可视化场景编辑器**

注意：`bin/index.html` 直接引 bundle 的启动方式，不影响 IDE 中编辑 `.scene`，两者独立。

## 步骤二：可视化摆放控件

在打开的 2D 场景编辑器中：

- 从组件面板拖入 **Image** 做背景（或在场景根节点设置 `bgColor`）
- 拖入 **Label**，属性面板改文字为"故事加载中…"、字号、颜色、对齐
- 拖入 **ProgressBar** 做进度条（改滑条图片与方向）
- 选中节点，右侧属性面板直接改 `x` / `y` / `width` / `height` / `anchorX` 等

保存后，所有属性以参数形式写入 `assets/loading.scene`——这就是"IDE 编辑资源"的实质：
**编辑器 = 可视化地写 JSON 参数文件**。

## 步骤三：代码加载场景

引擎 API（`LayaAir.d.ts` 第 24798 行）：

```typescript
static load(url: string, complete: Handler, progress?: Handler): Promise<Scene>;
```

在故事章节切换点调用：

```typescript
// 章节切换时
Laya.Scene.load("resources/loading.scene", Laya.Handler.create(this, (scene) => {
    Laya.stage.addChild(scene);
    // 拿到 scene 里的 ProgressBar，绑定真实加载进度
}));
```

注意：`.scene` 在 IDE 编译后走 `resources/` 前缀路径，IDE 会将场景及其引用的图片一并处理进资源管线（`bin/resources/`）。

## 方案对比

| 方案 | 适用 | 说明 |
|---|---|---|
| IDE 可视化（上述流程） | 静态界面、美术可接手 | 所见即所得，但交互仍需代码绑定 |
| 纯代码（项目现状） | 动态逻辑为主 | loading 的进度条数值、章节文案本就需要代码，纯代码更贴合现状 |

**建议**：loading 含动态进度逻辑，纯静态部分极少，纯代码更合适；若仅为体验 IDE 资源流程，创建简单场景练手成本最低。

---

## 附录：bundle 产物说明

### 是什么

`bin/js/bundles/bundle.js` 是 **IDE 内置 esbuild 的打包产物**——将 `src/` 下 11 个 TS 文件编译并合并成**单个可被浏览器直接执行的 JS 文件**。

当前产物实测：

- 文件大小：约 51.5 KB（52754 字节）
- 开头：`(() => {` —— **IIFE（立即执行函数表达式）**
- 内含 esbuild 注入的辅助函数：`__defProp`、`__hasOwnProp`、`__spreadValues`、`__name` 等
- 保留源文件注释标记：`// src/wuxia/data/GameData.ts`
- 类名被重命名加前缀防冲突：`var _GameData = class _GameData`

### 格式

**IIFE + 全局作用域变量（非 ES Module）**，特征：

1. 整个 bundle 是一个自执行函数 `(() => { ... })()`
2. 内部变量通过 `var` 声明、函数作用域提升实现跨文件共享
3. 不产出 `import` / `export` 语句，不依赖浏览器 module 加载器
4. 以**普通 `<script>` 标签**形式加载（见 `bin/index.html`）

### 意义

1. **兼容引擎**：LayaAir 引擎是全局 script（`laya.core.js` 等，非模块化），bundle 必须与其同用全局作用域对接——ESM 产物无法直接使用，必须打成 IIFE
2. **浏览器直接运行**：无需 module 服务器、无需 `.mjs` 配置，双击/静态服务器即可跑
3. **作用域隔离**：IIFE 包裹避免 11 个文件的变量互相污染全局；`__name` 等辅助函数保留类名便于调试
4. **构建链路**：tsc（`npm run build`）只负责类型检查 + 输出 ESM 到 `bin/js/modules/`，真正合成可运行 bundle 的是 esbuild。IDE 的 18090 调试服务器会把 `js/bundle.js` 请求重写为 `bundles/bundle.js`
