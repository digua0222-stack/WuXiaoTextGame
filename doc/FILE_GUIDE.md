# 逐文件说明 —— 人工介入开发手册

> 适用范围：后续人工（或 AI）介入开发前的速查文档。
> 本文档基于 **ES modules 重构后、可在 LayaAir IDE 中正常运行的代码** 编写（2026-08 状态）。
> 配套文档：`doc/README.md`（项目总览）、`doc/ART_TUTORIAL.md`（美术资源接入）、`doc/ARCHITECTURE.md`（架构设计）、`doc/BACKEND.md`（后端 API）。

---

## 1. 总览

### 1.1 目录结构

```
WuXiaoTextGame/
├── bin/                        # IDE 调试服务器根目录（http://localhost:18090/ 固定映射到此）
│   ├── index.html              # 页面入口，引引擎库 + js/bundle.js
│   ├── libs -> ../engine/LayaAir/build/libs   # 符号链接（引擎库）
│   └── js/
│       ├── bundle.js           # IDE 服务器动态重写 -> bundles/bundle.js
│       └── bundles/bundle.js   # ★ IDE 编译产物（esbuild iife），运行时真正加载的代码
├── engine/LayaAir/             # 引擎源码（git 忽略，本地 IDE 自带）
├── src/                        # ★ 全部游戏源码（TypeScript）
│   ├── Main.ts                 # 入口
│   └── wuxia/
│       ├── core/Game.ts        # 总控制器
│       ├── model/Hero.ts       # 数据契约（类型/接口/主角模型）
│       ├── data/GameData.ts    # 静态配置数据
│       ├── data/SaveManager.ts # 存档（localStorage）
│       ├── net/ApiClient.ts    # HTTP 客户端
│       ├── net/StorySource.ts  # 剧情数据源（远端+本地兜底）
│       ├── system/BattleSystem.ts  # 战斗系统
│       ├── system/GrowthSystem.ts  # 养成系统（数值计算）
│       ├── system/StorySystem.ts   # 剧情系统
│       └── ui/GameUI.ts        # 文字界面（纯代码 UI）
├── settings/                   # ★ IDE 编译配置（必须提交）
│   ├── CompilerSettings.json   # IDE 编译哪些 ts 文件（按 UUID 引用）
│   └── BuildSettings.json
├── server/server.js            # 可选后端（Node，静态服务+剧情 API）
├── tools/package.js            # 打包脚本（⚠️ 与现状有差异，见 §5）
├── doc/                        # 本文档目录
├── WuXiaoTextGame.laya         # IDE 工程文件
├── tsconfig.json               # tsc 类型检查/构建配置
├── capacitor.config.ts         # 打包移动端 App 用
└── package.json
```

### 1.2 架构分层

```
Main.ts（入口）
  └─ Game.ts（总控制器：命令分发、存档调度）
      ├─ GameUI.ts（界面层：实现 IGameUI）
      ├─ StorySystem.ts（剧情系统，依赖 StorySource 取节点）
      ├─ BattleSystem.ts（战斗系统）
      └─ GrowthSystem.ts（养成/数值计算，纯静态函数）
数据模型层：Hero.ts（契约）← GameData.ts（静态配置）← SaveManager.ts（存档）
网络层：ApiClient.ts（HTTP）→ StorySource.ts（剧情源：远程优先、本地兜底）
```

### 1.3 编译运行链路（重要！人工介入前必读）

1. **IDE 编译**：LayaAir IDE 启动时读 `settings/CompilerSettings.json` 的 `entries`（11 个 ts 文件的 UUID），点击“运行”后用 esbuild 把 `src/` 打成 **iife** bundle，输出到 `bin/js/bundles/bundle.js`。
2. **服务器映射**：IDE 调试服务器（端口 18090）根目录固定为 `bin/`，且把请求 `js/bundle.js` **重写**为磁盘上的 `js/bundles/bundle.js`。磁盘上 tsc 的产物不会被使用。
3. **类型检查**：`npm run build` 仅跑 tsc `--noEmit`（输出到 `bin/js/modules/` 供检查），真正运行靠 IDE 编译。
4. **引擎库**：`bin/index.html` 通过 `libs/`（符号链接→ `../engine/LayaAir/build/libs`）引用引擎 JS。

> ⚠️ 修改源码后必须回 IDE 重新点击“运行”才会重新编译。`CompilerSettings.json` 在 IDE 启动时缓存，改动后需重启 IDE。

---

## 2. 源码文件（src/）

### 2.1 `src/Main.ts` —— 程序入口

**职责**：初始化引擎舞台，创建游戏总控制器，配置通信模式。

**关键代码**：

```ts
export async function main(): Promise<void> {
    await Laya.init(960, 640);          // 舞台 960x640
    Laya.stage.bgColor = "#17171e";     // 舞台背景色（黑）
    Laya.stage.scaleMode = Laya.Stage.SCALE_FIXED_AUTO;
    Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
    Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
    new Game();                          // 启动游戏
    // ApiClient.baseUrl = "http://localhost:3000/api"; // 放开则启用后端模式
}
main();                                  // 模块顶层自动执行
```

**人工介入点**：
- 改舞台尺寸（960x640）、背景色、缩放模式。
- 想用后端剧情 → 放开 `ApiClient.baseUrl` 那行（需要先跑 `server/server.js`）。

**注意**：顶层 `main()` 是**自动调用**的（bundle 引入即启动），不依赖 IDE 的 `$_main_` 机制。

---

### 2.2 `src/wuxia/core/Game.ts` —— 总控制器

**职责**：组装四大系统（UI / 剧情 / 战斗 / 存档），解析玩家输入命令并分发。

**成员**：
- 私有字段：`hero`、`ui`（GameUI）、`battle`（BattleSystem）、`story`（StorySystem）。
- `setup()`：new 出 `Hero`，实例化 `GameUI`（传入命令回调 `this.handleCommand`）、`BattleSystem`、`StorySystem`，并让 UI 展示开场信息。
- `handleCommand(cmd)`：把输入行 trim 后按第一个词分发到各 `cmd*` 方法；未知命令提示输入 `help`。
- 命令集：`cmdHelp`（帮助）、`cmdStatus`（属性）、`cmdRest`（休息回血）、`cmdMeditate`（打坐回蓝）、`cmdAddPoint`（加点）、`cmdUse`（使用物品）、`cmdSave`（存档）、`cmdLoad`（读档）、`cmdNewGame`（重开）、`cmdTestBattle`（测试战斗）。

**人工介入点**：
- 加新命令：仿照现有 `cmd*` 方法，写一个方法并在 `handleCommand` 的分发处加一条分支。

**依赖**：Hero、GameUI、BattleSystem、StorySystem、SaveManager、GrowthSystem（数值）、GameData（物品名查 id）。

---

### 2.3 `src/wuxia/model/Hero.ts` —— 数据契约（最重要，先读它）

**职责**：定义全项目共享的类型/接口/主角模型。所有系统都引用它，**改动会影响全局**。

**导出的类型**：

| 导出 | 说明 |
|---|---|
| `HeroAttributes` | 四维属性：`strength`膂力 / `body`体魄 / `agility`身法 / `spirit`内息 |
| `SkillType` | `"inner"` 内功（被动）/ `"attack"` 外功（主动） |
| `SkillData` | 武功配置：`id/name/type/desc/power/mpCost/requireLevel/attrBonus?` |
| `EnemyDrop` | 掉落：`item/chance/count?` |
| `EnemyData` | 敌人配置：`id/name/desc/level/hp/mp/attack/defense/agility/hitRate/critRate/exp/money/drops?/skills?` |
| `StoryEffect` | 剧情效果（联合类型）：`exp/money/item/heal/mp/flag/skill/attribute/battle/next` |
| `StoryCondition` | 剧情条件：`level/flag/item/money/skill` |
| `StoryChoice` | 剧情选项：`text/next/require?/effect?` |
| `StoryNode` | 剧情节点：`id/text/choices?/effect?/next?` |
| `ItemData` | 物品：`id/name/desc/healHp?/healMp?` |
| `IGameUI` | UI 接口（**系统层与界面层解耦的关键**）：`log/showChoices/clearChoices/refreshStatus/setInputHint` |
| `Hero` | 主角类（见下） |

**Hero 类字段**：`name`、`level`、`exp`、`freePoints`（自由属性点）、`hp`、`mp`、`money`、`attrs`、`skills`（已学武功 id 数组）、`items`（id→数量）、`flags`（剧情标志）、`currentNode`、`createdTime`。

**Hero 方法**：`hasFlag/addFlag`、`hasItem/addItem/removeItem`、`toSave()`（导出存档对象）、`static fromSave(data)`（反序列化，含默认值兜底）。

**人工介入点**：
- 加新属性 → 改 `HeroAttributes` 或 Hero 字段，并同步 `toSave/fromSave`（否则读档丢数据）。
- 加新物品类型（如装备）→ 扩展 `ItemData` + `GameData.items` + `GrowthSystem` 相关逻辑。

---

### 2.4 `src/wuxia/data/GameData.ts` —— 静态配置数据

**职责**：内置全部游戏配置（无后端时数据来源）。

**成员**（均为 `static`）：
- `items`、`skills`、`enemies`、`stories` —— 四个 id→配置 的映射表。
- 查询函数：`getItem(id)`、`getSkill(id)`、`getEnemy(id)`、`getStory(id)`。

**人工介入点**：
- **加剧情**：往 `stories` 里加 `StoryNode`（id 唯一），用 `next`/`choices` 串联；触发战斗用 effect `{ type:"battle", enemy, win, lose }`。
- **加敌人**：往 `enemies` 里加 `EnemyData`；**加武功**：往 `skills` 加 `SkillData`；**加物品**：往 `items` 加 `ItemData`。
- 所有 id 必须与 `Hero.ts` 中的类型定义字段匹配，否则类型检查报错。

---

### 2.5 `src/wuxia/data/SaveManager.ts` —— 存档

**职责**：localStorage 读写。

**成员**（均 `static`）：
- `SAVE_KEY = "wuxia_save_v1"`（改存档格式版本时应递增，如 `v2`）。
- `save(hero)`、`load(): Hero | null`（内部 `Hero.fromSave`）、`clear()`、`hasSave()`。

**人工介入点**：
- 存档字段变化（见 Hero 的 `toSave/fromSave`）时，建议递增 `SAVE_KEY` 版本号，避免老存档解析出错。

---

### 2.6 `src/wuxia/net/ApiClient.ts` —— HTTP 客户端

**职责**：封装 `Laya.HttpRequest` 的 Promise 化请求。

**成员**（均 `static`）：
- `baseUrl = ""`：默认空 = 离线模式（Main.ts 里放开赋值才走远端）。
- `get online(): boolean`：`baseUrl` 非空即在线。
- `get<T>(path, timeout=8000)`、`post<T>(path, data, timeout=8000)`、`private request(...)`（超时/错误处理）。

**人工介入点**：一般不需要改；如需自定义请求头/错误提示，改 `request`。

---

### 2.7 `src/wuxia/net/StorySource.ts` —— 剧情数据源

**职责**：统一取剧情节点：远程优先（`ApiClient` 拉 `/api/story/:id`）、失败/离线自动回退本地（`GameData`），带内存缓存与并发去重。

**成员**（均 `static`）：
- `private cache`、`private loading`（正在加载的 Promise 去重）。
- `get(id): Promise<StoryNode | null>`（先查缓存 → 在线则 `fromRemote` → 失败回退 `fromLocal`）。
- `private fromRemote(id)`、`private fromLocal(id)`。
- `clearCache()`。

**人工介入点**：
- 若后端剧情接口路径变了，改 `fromRemote` 里的 URL。
- 想强制只用本地/只用远端，改 `get` 的逻辑分支。

---

### 2.8 `src/wuxia/system/BattleSystem.ts` —— 战斗系统

**职责**：回合制战斗：玩家攻击/防御/逃跑，敌人 AI 反击，属性受 `GrowthSystem` 数值影响，结算胜负与掉落。

**内部类**：
- `BattleEnemy`：`data: EnemyData` + 实际 `hp/mp`，构造时按 `levelScale` 缩放（`constructor(data, levelScale)`）。

**BattleSystem 成员**：
- 私有：`hero`、`ui`（IGameUI）、`enemy`、`enemyScale`、`onEnd`（结算回调）、`guarding`。
- `get running(): boolean`：战斗是否进行中。
- `start(enemyId, onEnd(win, drops), scale?)`：开战（Game.ts 的 `cmdTestBattle` 调用）。
- `handleInput(cmd)`（分发命令：技能/防御/逃跑）。
- `showActions()`、`playerAttack(skillId?)`、`playerGuard()`、`playerFlee()`、`enemyTurn()`、`dodgeRateOf(e)`、`endBattle(win, fled=false)`。

**人工介入点**：
- 改战斗规则（伤害公式、暴击、闪避）→ 看 `playerAttack` / `enemyTurn` / `GrowthSystem` 的数值函数。
- 改掉落逻辑 → `endBattle`。
- 加战斗 UI（如敌人立绘）→ 通过 `ui.log` 通知界面，具体见 `doc/ART_TUTORIAL.md`。

---

### 2.9 `src/wuxia/system/GrowthSystem.ts` —— 养成系统

**职责**：纯静态数值计算（无状态），所有属性公式都在这里。

**成员**（均 `static`）：
- 上限/恢复：`maxHp(hero)`、`maxMp(hero)`。
- 战斗数值：`attack(hero)`、`defense(hero)`、`hitRate(hero)`、`critRate(hero)`、`dodgeRate(hero)`。
- 养成行为：`useItem(hero, itemId)`（食物回血/蓝）、`meditate(hero, minutes)`（打坐）、`gainExp(hero, exp)`（升级、回满状态、得自由点）、`addPoint(hero, key)`（加点）、`expNeed(level)`（升级所需经验）、`innerBonus(hero)`（内功被动四维加成）。

**人工介入点**：
- **改数值平衡**都在这里：如 `maxHp = body * 20` 之类公式、升级经验曲线 `expNeed`。
- 新增养成玩法（如修炼武功、装备系统）→ 加静态方法，供 Game/Story/Battle 调用。

---

### 2.10 `src/wuxia/system/StorySystem.ts` —— 剧情系统

**职责**：驱动剧情：进入节点 → 展示文本与选项 → 应用效果（`applyEffects`）→ 校验条件（`checkConditions`）→ 触发战斗/跳转。

**成员**：
- 私有：`hero`、`ui`（IGameUI）、`battle`、`pendingNode`（战斗胜利后待进入的节点）。
- `constructor(hero, ui, battle)`。
- `enter(nodeId)`：异步 `StorySource.get(nodeId)` → 渲染文本 + 选项。
- `private showChoices(node)`、`private applyEffects(effects)`（exp/money/item/heal/flag/skill/attribute/battle/next 的处理都在这里）、`private checkConditions(conds)`。

**人工介入点**：
- 新增剧情效果类型 → `Hero.ts` 的 `StoryEffect` 联合类型 + 本文件 `applyEffects` 加分支。
- 改剧情触发战斗的方式 → `applyEffects` 里的 `"battle"` 分支。

---

### 2.11 `src/wuxia/ui/GameUI.ts` —— 文字界面（纯代码 UI，无场景文件）

**职责**：实现 `IGameUI`，用 Laya 代码绘制全部界面（日志滚动区、顶栏状态、选项按钮、输入框）。

**布局常量**（改界面尺寸/配色看这里）：
- `LOG_W=920`、`LOG_H=420`（日志区），`MAX_ROWS=120`（日志行数上限），`FONT="Microsoft YaHei"`。
- 舞台 960x640；**底板 `bg`：`drawRect(0,0,960,640,"#17171e")`（§黑色底板）**；顶栏 `bar`：960x52 `#23232e`；日志背景 `#101015` + 边框 `#2a2a35`；输入框底 `#1d1d26`。
- 按钮配色：底 `#3a3a4a`、边框 `#55556a`、悬停 `#4a4a5e`/`#66667c`。

**成员**：
- 日志：`logContent`/`logView`（带 mask 滚动）、`logRows`、`totalH`；`log(text,color)` 追加并滚动到底。
- 顶栏状态：`stName/stHp/stMp/stMoney/stPoints`；`refreshStatus(hero)` 更新。
- 选项：`choiceBox`、`choiceButtons`；`showChoices(choices)`、`clearChoices()`。
- 输入：`input`（回车触发 `onCommand`）、`sendBtn`；`setInputHint(hint)`。
- 工具方法：`makeText(t,color,size,bold)`、`makeButton(text,w,h,handler)`。

**人工介入点**：
- 改样式（颜色/字体/尺寸）→ 改 `build()` 里的 `drawRect` 颜色与布局常量。
- 加新 UI 区域（立绘、血条、地图）→ 在 `build()` 里 new Sprite 并 addChild。
- **接入美术资源（背景图/立绘/按钮图）→ 详见 `doc/ART_TUTORIAL.md`**。

---

## 3. IDE / 编译相关文件（务必理解）

### 3.1 `settings/CompilerSettings.json` —— ★ IDE 编译入口配置

IDE 启动时读取；决定**哪些 ts 被编译进 bundle**。`entries` 里按 UUID 列出 src 下 11 个 ts 文件，`mainScript` 指向 `Main.ts` 的 UUID。

- 新增一个 ts 文件后，必须把它的 UUID（`.meta` 文件里的）加进 `entries`，否则 IDE 不编译它 → 黑屏。
- 修改后**重启 IDE** 生效。
- UUID 与文件对应关系：每个 `.ts` 旁的 `.meta` 文件第一行的 `uuid`。

### 3.2 `settings/BuildSettings.json`

IDE 发布/构建设置（场景、包名等）。一般不用手改。

### 3.3 `WuXiaoTextGame.laya`

LayaAir IDE 工程描述文件（记录工程名、默认场景等）。IDE 自动维护。

### 3.4 `.meta` 文件（`src/**/*.ts.meta`）

IDE 资源系统为每个 ts 生成，核心是 `uuid`。**不要手动改**；增删文件时 IDE 会自动生成/删除。提交进 git（IDE 依赖）。

### 3.5 `tsconfig.json`

- `module: "ESNext"`、`moduleResolution: "node"`、`target` 按引擎要求。
- `outDir: "bin/js/modules"`：仅 tsc 构建输出（类型检查用），**IDE 运行不读它**。
- 之前用 `outFile` 合并 namespace 的配置已废弃。

### 3.6 `bin/index.html`

页面入口。关键引用：
- `libs/laya.core.js`、`libs/laya.webgl_2D.js`、`libs/laya.ui.js`（经符号链接 `bin/libs`）。
- `js/bundle.js`（IDE 动态重写为实际编译产物）。
- ⚠️ 不要改回 `../engine/...` 相对路径（IDE 服务器根=bin，那样会 404）。

### 3.7 `bin/libs` —— 符号链接

指向 `../engine/LayaAir/build/libs`（引擎构建产物）。`git` 会以符号链接形式提交，克隆后 Linux/macOS 自动有效；**Windows 克隆后需重新 `mklink`**。

### 3.8 `bin/js/bundles/bundle.js`

IDE 编译产物（git 忽略）。**不要手动编辑**，也不要把它当作源码提交。

---

## 4. 工程配置文件

### 4.1 `package.json`

- `npm run build`：tsc 类型检查 + 输出（本地验证用）。
- 无运行时 npm 依赖（引擎在 `engine/`）。

### 4.2 `.gitignore`

忽略：`node_modules/`、`dist/`、`engine/`（引擎太大，IDE 自带）、`bin/js/bundles`（编译产物）、`bin/js/modules`（tsc 产物）、`library/`、`local/`（IDE 缓存）。

### 4.3 `capacitor.config.ts`

Capacitor 配置（打包 Android/iOS App 用，与 Web 运行无关）。

---

## 5. 服务端 / 打包工具（⚠️ 与现状的差异提示）

### 5.1 `server/server.js`

可选后端：静态服务 + `GET /api/story/:id` 剧情接口。README 里的注释仍写 `WuXia.ApiClient`（旧命名），实际应为 `ApiClient.baseUrl`。若要启用后端：`node server/server.js` 后，在 `Main.ts` 放开 `ApiClient.baseUrl` 赋值。

### 5.2 `tools/package.js`

打包脚本（生成单文件版/静态站）。⚠️ **与现状不一致**：它假设 tsc 直出 `bin/js/bundle.js`，而当前实际 bundle 由 IDE 生成在 `bin/js/bundles/bundle.js`（tsc 输出在 `bin/js/modules/`）。如需使用此脚本，须先适配 bundle 路径。

---

## 6. 常见开发任务速查

| 想做什么 | 改哪里 |
|---|---|
| 加一段剧情 | `GameData.ts` 的 `stories` + `StoryNode` |
| 加敌人 | `GameData.ts` 的 `enemies` + `EnemyData` |
| 加武功/物品 | `GameData.ts` 的 `skills`/`items` |
| 调数值平衡 | `GrowthSystem.ts`（公式、经验曲线） |
| 改战斗规则 | `BattleSystem.ts`（playerAttack/enemyTurn） |
| 改剧情逻辑/新效果 | `StorySystem.ts` 的 `applyEffects` + `Hero.ts` 的 `StoryEffect` |
| 改 UI 配色/布局 | `GameUI.ts` 的 `build()` 与布局常量 |
| 加美术资源 | `doc/ART_TUTORIAL.md` |
| 加新 ts 文件 | 写文件 → IDE 生成 `.meta` → 把 UUID 加入 `CompilerSettings.json` → 重启 IDE |
| 启用后端剧情 | 跑 `server/server.js` → 放开 `Main.ts` 的 `ApiClient.baseUrl` |
