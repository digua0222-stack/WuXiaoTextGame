# 架构设计

## 1. 技术栈

- **引擎**：LayaAir 3.x（WebGL 2D）
- **语言**：TypeScript（namespace 组织，target ES2017）
- **构建**：tsc 直接编译输出 `bin/js/bundle.js`，`index.html` 引引擎库 + bundle

## 2. 目录结构

```
src/
├── Main.ts                     入口：初始化引擎，启动游戏
└── wuxia/
    ├── model/Hero.ts           主角模型 + 公共类型定义
    ├── data/GameData.ts        静态配置（物品/武功/敌人/剧情节点）
    ├── data/SaveManager.ts     存档系统（localStorage）
    ├── system/GrowthSystem.ts  属性养成框架
    ├── system/BattleSystem.ts  回合制战斗框架
    ├── system/StorySystem.ts   节点式剧情框架
    ├── net/ApiClient.ts        网络层（后端通信，可扩展）
    ├── net/StorySource.ts      剧情数据源（远程优先/本地兜底）
    ├── ui/GameUI.ts            界面层（状态栏/日志/选项/输入）
    └── core/Game.ts            总控制器（命令分发/读档/新游戏）
```

## 3. 四大框架

### 3.1 主角模型（Hero）

- 四维属性：膂力 / 体魄 / 身法 / 内息
- 等级、经验、气血、内力、银两
- 物品背包、武功列表、剧情标志（flag）
- 完整支持序列化存档 / 读档

### 3.2 剧情框架（StorySystem）

节点式剧情，**有向图结构而非二叉树**：

- 每个节点 `StoryNode` 支持任意数量选项 `choices[]`（数组，非 2 选 1）
- 选项可带 `require` 条件：等级 / 物品 / 银两 / 标志 / 武功，不满足显示为灰字
- 选项可带 `effect` 效果：经验 / 银两 / 物品 / 恢复 / 学武 / 加属性 / 触发战斗 / 跳转
- 战斗效果会**挂起剧情**，胜负后按 `win`/`lose` 分流
- 多节点可汇合（`next` 指向同一节点）、可循环、可做多结局（无 `next` 即终点）
- 数据加载走 `StorySource`：后端开启时远程拉取，失败回退本地 `GameData`

### 3.3 战斗框架（BattleSystem）

回合制：

- 命中 / 闪避 / 暴击判定
- 防御姿态（减伤）
- 武功施展（耗内力，可学多个技能）
- 逃跑
- 敌人 AI：概率使用技能
- 胜利结算：经验 / 银两 / 掉落
- 敌人可按玩家等级缩放强度

### 3.4 属性养成（GrowthSystem）

- 升级自动增长四维
- 每次升级 +3 自由属性点（`add 体魄` 分配）
- 内功被动四维加成
- 消耗品使用（`use 卤牛肉`）
- 打坐恢复（效率看内息）

## 4. 交互设计

### 4.1 双通道交互

| 通道 | 载体 | 用途 |
|------|------|------|
| 剧情按钮 | 选择区按钮 | 剧情推进的快车道 |
| 自由指令 | 底部输入框 + 回车 | 系统/养成/战斗操作入口 |

按钮与输入框最终都汇入 `Game.handleCommand` 同一分发管线。

### 4.2 指令集

```
help / 属性 / 休息 / 打坐 / add 体魄 / use 卤牛肉
存档 / 读档 / 重新开始
battle 野狼          ← 调试用
```

## 5. 模块解耦

系统层（`Game` / `BattleSystem` / `StorySystem`）与 UI 层通过 `IGameUI` 接口解耦：

```ts
export interface IGameUI {
    showText(...): void;
    showChoices(choices: ChoiceOption[], onSelect: (i: number) => void): void;
    setStatus(...): void;
    setBattle(...): void;
    showPrompt(...): void;
}
```

**好处**：接入美术 / 更换 UI 实现时，只需重写 `GameUI` 实现类，系统层零改动。

## 6. 已踩过的坑（重要）

1. **按钮无法点击**：LayaAir 3 命中检测要求 `width > 0 && height > 0`，
   仅 `graphics.drawRect` 画图形不会撑起宽高。必须 `btn.size(w, h)`。
2. **服务器根目录**：`index.html` 用 `../engine/...` 相对路径引用引擎，
   服务器必须以项目根为站点根（`npx serve -l 8000`），访问 `/bin/`。
