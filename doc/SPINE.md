# Spine 骨骼动画接入攻略（LayaAir 3）

本文档基于本项目实际环境验证：
- LayaAir 3.x 引擎（`engine/LayaAir/`），已内置完整 Spine 支持
- 纯 tsc + namespace 代码风格（`WuXia` 命名空间），无 LayaAir IDE 工程
- 入口 `bin/index.html`，静态资源放 `bin/res/`

---

## 1. 准备 Spine 资源（美术导出）

| 项目 | 要求 |
|---|---|
| 导出格式 | JSON（`.json`）或二进制（`.skel`）均可 |
| 版本 | 必须在 3.7 ~ 4.2 之间（引擎内置这 5 个版本的运行时） |
| 必备三件套 | `xxx.skel`（或 `xxx.json`）+ `xxx.atlas` + 贴图 png |
| 命名与位置 | 三个文件**同名、同目录**（`atlas` 内引用的 png 路径相对 atlas 所在目录） |

> 贴图尽量打成一个图集（Spine 导出自带图集功能），减少 drawcall。

## 2. 资源放置

```
bin/
├── index.html
├── js/
└── res/spine/          ← 新建，放入
    ├── hero.skel       (或 hero.json)
    ├── hero.atlas
    └── hero.png
```

> 路径说明：`bin/index.html` 是页面入口，Laya 加载器默认以它所在目录为基准，
> 所以代码里写 `"res/spine/hero.skel"` 即对应 `bin/res/spine/hero.skel`。

## 3. 入口 HTML 引入 Spine 引擎库（最关键）

当前 `bin/index.html` 只有 3 个引擎库，必须补两行，**顺序不能错**
（`spine-core` 必须在 `laya.spine` 之前，`laya.spine.js` 内部直接使用全局 `spine` 对象）：

```html
<script src="../engine/LayaAir/build/libs/laya.core.js"></script>
<script src="../engine/LayaAir/build/libs/laya.webgl_2D.js"></script>
<script src="../engine/LayaAir/build/libs/laya.ui.js"></script>

<!-- ↓ 新增 -->
<script src="../engine/LayaAir/build/libs/spine-core-4.2.js"></script>
<script src="../engine/LayaAir/build/libs/laya.spine.js"></script>

<script src="js/bundle.js"></script>
```

`engine/LayaAir/build/libs/` 下提供 `spine-core-3.7 / 3.8 / 4.0 / 4.1 / 4.2` 五个版本，
选与导出资源匹配的版本即可。

## 4. 代码使用

类型声明已内置在 `LayaAir.d.ts`（`Spine2DRenderNode` / `SpineSkeleton` / `SpineTemplet`），
**tsconfig 无需任何改动**。

### 方式 A（推荐）：`Spine2DRenderNode` 组件

```ts
namespace WuXia {
    export class SpineDemo {
        /** 方式1：给 source，引擎自动加载 */
        static show(parent: Laya.Sprite): void {
            const node = new Laya.Spine2DRenderNode();
            node.source = "res/spine/hero.skel";   // setter 内部自动走加载管线
            node.pos(200, 300);
            node.scale(0.5, 0.5);
            node.play("walk", true, true);          // (动画名, 是否循环, 是否强制播放)
            parent.addChild(node);
        }

        /** 方式2：预加载 templet（可复用同一份数据，配缓存性能更好） */
        static async showByTemplet(parent: Laya.Sprite): Promise<void> {
            const templet: Laya.SpineTemplet =
                await Laya.loader.load("res/spine/hero.skel", Laya.Loader.SPINE);

            const node = new Laya.Spine2DRenderNode();
            node.templet = templet;
            node.play("attack", false, true);
            parent.addChild(node);
        }
    }
}
```

### 方式 B（旧式兼容）：`SpineSkeleton`（标记 deprecated，但可用）

```ts
const sk = new Laya.SpineSkeleton();
sk.source = "res/spine/hero.skel";
sk.pos(200, 300);
sk.play("walk", true, true);
parent.addChild(sk);
```

### 常用 API 速查

| 调用 | 说明 |
|---|---|
| `node.play("walk", true, true)` | 播放（名字/索引, 循环, force） |
| `node.animationName` / `node.loop` | 属性式切换 |
| `node.playbackRate(0.8)` | 变速 |
| `node.skinName = "red"` | 换肤 |
| `node.paused = true` | 暂停 |
| `node.getAniNameByIndex(i)` / `node.getAnimNum()` | 枚举动画列表 |
| `node.enableCache = true` | 渲染数据缓存，重复播放性能优化 |
| `node.useFastRender = false` | 仅当顶点骨骼控制数 >4 渲染错乱时关闭 |

## 5. 版本匹配（可选）

```ts
// 建议与第 3 步引入的 spine-core 版本、以及资源导出版本保持一致
Laya.SpineConst.VERSION = "4.2";
```

## 6. 构建与验证

```
npm run build     # tsc 编译 → bin/js/bundle.js
npm run start     # 起本地服务 http://localhost:8000/bin/
```

浏览器打开后看控制台：
- 无 `404` → 资源路径正确
- 无 `spine is not defined` → 库引入顺序/缺失正确

---

## 常见坑

1. **忘了引入 `spine-core-*.js`** → 报 `spine is not defined`
2. **三件套不同名/不同目录** → atlas 找不到贴图，白屏
3. **`.skel` 是二进制** → 不能按文本加载，必须走 `Loader.SPINE`（引擎自动处理）
