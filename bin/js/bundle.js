/**
 * 武侠文字游戏 —— 入口
 * 搭建：主角 / 剧情 / 战斗 / 养成 四大框架
 */
async function main() {
    await Laya.init(960, 640);
    Laya.stage.bgColor = "#17171e";
    Laya.stage.scaleMode = Laya.Stage.SCALE_FIXED_AUTO;
    Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
    Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
    // 启动游戏
    new WuXia.Game();
    // 启用后端通信模式（默认离线，仅读本地 GameData）
    // 放开下面一行即可改为：剧情数据从服务器 /api/story/:id 拉取，失败自动回退本地
    // WuXia.ApiClient.baseUrl = "http://localhost:3000/api";
}
main();
var WuXia;
(function (WuXia) {
    /** 游戏总控制器：串联 UI / 主角 / 剧情 / 战斗 / 养成 */
    class Game {
        constructor() {
            this.setup();
        }
        setup() {
            // 读档或新游戏
            const saved = WuXia.SaveManager.load();
            this.hero = saved || new WuXia.Hero();
            this.ui = new WuXia.GameUI((cmd) => this.handleCommand(cmd));
            this.battle = new WuXia.BattleSystem(this.hero, this.ui);
            this.story = new WuXia.StorySystem(this.hero, this.ui, this.battle);
            this.ui.refreshStatus(this.hero);
            if (saved) {
                this.ui.log("已读取存档。", "#a0a0a0");
            }
            else {
                this.ui.log("这是一段属于你的江湖故事。", "#a0a0a0");
            }
            // 从存档节点继续，或从头开始
            this.story.enter(this.hero.currentNode);
        }
        // ───────────────── 命令分发 ─────────────────
        handleCommand(cmd) {
            // 战斗中优先交给战斗系统
            if (this.battle.running) {
                this.battle.handleInput(cmd);
                return;
            }
            const c = cmd.trim().toLowerCase();
            const words = c.split(/\s+/);
            const first = words[0];
            switch (first) {
                case "help":
                case "帮助":
                    this.cmdHelp();
                    break;
                case "status":
                case "属性":
                case "查看":
                    this.cmdStatus();
                    break;
                case "rest":
                case "休息":
                    this.cmdRest();
                    break;
                case "meditate":
                case "打坐":
                    this.cmdMeditate();
                    break;
                case "add":
                case "加":
                    this.cmdAddPoint(words[1]);
                    break;
                case "use":
                case "使用":
                    this.cmdUse(words.slice(1).join(" "));
                    break;
                case "save":
                case "存档":
                    this.cmdSave();
                    break;
                case "load":
                case "读档":
                    this.cmdLoad();
                    break;
                case "new":
                case "重新开始":
                    this.cmdNewGame();
                    break;
                case "battle":
                case "切磋":
                    this.cmdTestBattle(words[1]);
                    break;
                default:
                    this.ui.log(`未知指令「${cmd}」。输入 help 查看帮助。`, "#888888");
            }
        }
        // ───────────────── 指令实现 ─────────────────
        cmdHelp() {
            const h = [
                "── 指令说明 ──",
                "help / 帮助　　查看指令说明",
                "status / 属性　查看角色详细属性",
                "rest / 休息　　回满气血与内力",
                "meditate / 打坐　调息恢复（效率看内息）",
                "add 体魄 / 加 膂力　分配自由属性点",
                "use 卤牛肉 / 使用 野山参　服用物品",
                "save / 存档　　load / 读档",
                "new / 重新开始　放弃进度重新来过",
                "剧情进行时，点击下方按钮推进故事。"
            ];
            for (const line of h)
                this.ui.log(line, "#a8d8ff");
        }
        cmdStatus() {
            const h = this.hero;
            const bonus = WuXia.GrowthSystem.innerBonus(h);
            const bonusText = (k) => bonus[k] > 0 ? ` (+${bonus[k]}内功)` : "";
            const attrNames = {
                strength: "膂力", body: "体魄", agility: "身法", spirit: "内息"
            };
            const lines = [
                [`${h.name}　Lv.${h.level}`, "#e8c86a"],
                [`经验 ${h.exp} / ${WuXia.GrowthSystem.expNeed(h.level)}`, "#a0a0a0"],
                [`气血 ${h.hp}/${WuXia.GrowthSystem.maxHp(h)}　内力 ${h.mp}/${WuXia.GrowthSystem.maxMp(h)}`, "#a0a0a0"],
                ["", ""]
            ];
            for (const k of ["strength", "body", "agility", "spirit"]) {
                lines.push([`${attrNames[k]} ${h.attrs[k]}${bonusText(k)}`, "#d8c8a0"]);
            }
            lines.push(["", ""]);
            lines.push([`攻击 ${WuXia.GrowthSystem.attack(h)}　防御 ${WuXia.GrowthSystem.defense(h)}`, "#d8c8a0"]);
            lines.push([
                `命中 ${Math.round(WuXia.GrowthSystem.hitRate(h) * 100)}%　暴击 ${Math.round(WuXia.GrowthSystem.critRate(h) * 100)}%　闪避 ${Math.round(WuXia.GrowthSystem.dodgeRate(h) * 100)}%`,
                "#d8c8a0"
            ]);
            lines.push([`银两 ${h.money}　自由属性点 ${h.freePoints}`, "#ffd966"]);
            if (h.skills.length > 0) {
                lines.push(["", ""]);
                const names = h.skills.map(id => { var _a; return ((_a = WuXia.GameData.getSkill(id)) === null || _a === void 0 ? void 0 : _a.name) || id; }).join("、");
                lines.push([`武功：${names}`, "#ffcc44"]);
            }
            if (Object.keys(h.items).length > 0) {
                lines.push(["", ""]);
                const itemNames = Object.keys(h.items)
                    .map(id => { var _a; return `${((_a = WuXia.GameData.getItem(id)) === null || _a === void 0 ? void 0 : _a.name) || id} x${h.items[id]}`; })
                    .join("、");
                lines.push([`物品：${itemNames}`, "#66ff99"]);
            }
            for (const [t, c] of lines)
                this.ui.log(t || "　", t ? c : "#2a2a2a");
        }
        cmdRest() {
            const h = this.hero;
            h.hp = WuXia.GrowthSystem.maxHp(h);
            h.mp = WuXia.GrowthSystem.maxMp(h);
            this.ui.log("你寻了处干净地方歇息，气血与内力尽复。", "#7ec8ff");
            this.ui.refreshStatus(h);
        }
        cmdMeditate() {
            const tip = WuXia.GrowthSystem.meditate(this.hero);
            this.ui.log(tip, "#7ec8ff");
            this.ui.refreshStatus(this.hero);
        }
        cmdAddPoint(arg) {
            if (!arg) {
                this.ui.log(`用法：add 膂力|体魄|身法|内息（当前自由属性点 ${this.hero.freePoints}）`, "#888888");
                return;
            }
            if (this.hero.freePoints <= 0) {
                this.ui.log("没有可分配的自由属性点，去历练升级吧。", "#ff8888");
                return;
            }
            const map = {
                "膂力": "strength", "体魄": "body", "身法": "agility", "内息": "spirit",
                "strength": "strength", "body": "body", "agility": "agility", "spirit": "spirit"
            };
            const key = map[arg];
            if (!key) {
                this.ui.log("属性名有误，可选：膂力 / 体魄 / 身法 / 内息", "#888888");
                return;
            }
            if (WuXia.GrowthSystem.addPoint(this.hero, key)) {
                const names = {
                    strength: "膂力", body: "体魄", agility: "身法", spirit: "内息"
                };
                this.ui.log(`${names[key]} +1（剩余属性点 ${this.hero.freePoints}）。`, "#ffcc44");
                this.ui.refreshStatus(this.hero);
            }
        }
        cmdUse(itemName) {
            if (!itemName) {
                this.ui.log("用法：use 物品名称", "#888888");
                return;
            }
            // 按名称匹配
            let targetId = null;
            for (const id of Object.keys(this.hero.items)) {
                const it = WuXia.GameData.getItem(id);
                if (it && (it.name === itemName || it.id === itemName)) {
                    targetId = id;
                    break;
                }
            }
            if (!targetId) {
                this.ui.log(`你没有名为「${itemName}」的物品。`, "#ff8888");
                return;
            }
            const result = WuXia.GrowthSystem.useItem(this.hero, targetId);
            if (result) {
                this.ui.log(result, "#66ff99");
                this.ui.refreshStatus(this.hero);
            }
            else {
                this.ui.log("该物品无法使用。", "#888888");
            }
        }
        cmdSave() {
            WuXia.SaveManager.save(this.hero);
            this.ui.log("已存档。", "#a0a0a0");
        }
        cmdLoad() {
            const h = WuXia.SaveManager.load();
            if (!h) {
                this.ui.log("没有找到存档。", "#ff8888");
                return;
            }
            this.hero = h;
            this.battle = new WuXia.BattleSystem(this.hero, this.ui);
            this.story = new WuXia.StorySystem(this.hero, this.ui, this.battle);
            this.ui.refreshStatus(this.hero);
            this.ui.log("读档成功，继续你的江湖之旅。", "#66ff99");
            this.story.enter(h.currentNode);
        }
        cmdNewGame() {
            WuXia.SaveManager.clear();
            this.hero = new WuXia.Hero();
            this.battle = new WuXia.BattleSystem(this.hero, this.ui);
            this.story = new WuXia.StorySystem(this.hero, this.ui, this.battle);
            this.ui.refreshStatus(this.hero);
            this.ui.log("新的江湖之旅开始了。", "#66ff99");
            this.story.enter("story_start");
        }
        /** 调试用：输入 battle 野狼 可自由切磋 */
        cmdTestBattle(enemyId) {
            const id = enemyId && WuXia.GameData.getEnemy(enemyId) ? enemyId : "wolf";
            this.battle.start(id, (win) => {
                if (win) {
                    this.ui.log("切磋结束。", "#a0a0a0");
                }
                else {
                    this.hero.hp = Math.max(1, Math.round(WuXia.GrowthSystem.maxHp(this.hero) * 0.5));
                    this.ui.log("切磋失败……你强撑着爬起来。", "#ff8888");
                }
                this.ui.refreshStatus(this.hero);
            }, 1 + (this.hero.level - 1) * 0.15);
        }
    }
    WuXia.Game = Game;
})(WuXia || (WuXia = {}));
var WuXia;
(function (WuXia) {
    /** 静态配置数据：物品 / 武功 / 敌人 / 剧情 */
    class GameData {
        /** 获取武功 */
        static getSkill(id) {
            return GameData.skills[id];
        }
        /** 获取敌人 */
        static getEnemy(id) {
            return GameData.enemies[id];
        }
        /** 获取物品 */
        static getItem(id) {
            return GameData.items[id];
        }
        /** 获取剧情节点 */
        static getStory(id) {
            return GameData.stories[id];
        }
    }
    GameData.items = {
        "beef": { id: "beef", name: "卤牛肉", desc: "老翁相赠的卤牛肉，吃下可恢复气血。", healHp: 40 },
        "gingseng": { id: "gingseng", name: "野山参", desc: "山中偶得的野山参，服之恢复气血内力。", healHp: 80, healMp: 40 },
        "wolf_pelt": { id: "wolf_pelt", name: "狼皮", desc: "质地坚韧的狼皮，可在镇上换些银两。" },
        "sword_wood": { id: "sword_wood", name: "木剑", desc: "武馆教头所赠的木剑，聊胜于无。" }
    };
    GameData.skills = {
        "basic_fist": {
            id: "basic_fist", name: "太祖长拳", type: "attack",
            desc: "江湖人都会的入门拳法，稳扎稳打。",
            power: 40, mpCost: 6, requireLevel: 1
        },
        "taiji_sword": {
            id: "taiji_sword", name: "太极剑法", type: "attack",
            desc: "以柔克刚的武当剑法，威力不俗。",
            power: 80, mpCost: 14, requireLevel: 3
        },
        "tuna_skill": {
            id: "tuna_skill", name: "吐纳心法", type: "inner",
            desc: "最基础的调息法门，常年习之可强身健体。",
            power: 0, mpCost: 0, requireLevel: 1,
            attrBonus: { body: 2, spirit: 2 }
        },
        "hundun_gong": {
            id: "hundun_gong", name: "混元功", type: "inner",
            desc: "外家硬功，淬炼筋骨，大幅提升体魄。",
            power: 0, mpCost: 0, requireLevel: 4,
            attrBonus: { body: 5, strength: 2 }
        }
    };
    GameData.enemies = {
        "gangster": {
            id: "gangster", name: "地痞", desc: "镇口欺压百姓的地痞，拳脚粗糙。",
            level: 1, hp: 40, mp: 0, attack: 6, defense: 1, agility: 3,
            hitRate: 0.82, critRate: 0.04, exp: 12, money: 8
        },
        "wolf": {
            id: "wolf", name: "野狼", desc: "落单的饿狼，眼冒凶光。",
            level: 2, hp: 55, mp: 0, attack: 9, defense: 2, agility: 6,
            hitRate: 0.85, critRate: 0.08, exp: 25, money: 5,
            drops: [{ item: "wolf_pelt", chance: 0.6 }]
        },
        "bandit": {
            id: "bandit", name: "山贼", desc: "拦路打劫的山贼，下手狠辣。",
            level: 3, hp: 75, mp: 0, attack: 12, defense: 3, agility: 5,
            hitRate: 0.84, critRate: 0.08, exp: 40, money: 25,
            drops: [{ item: "gingseng", chance: 0.35 }]
        },
        "coach": {
            id: "coach", name: "武馆教头", desc: "武馆的教头，出拳虎虎生风。",
            level: 4, hp: 110, mp: 20, attack: 15, defense: 5, agility: 7,
            hitRate: 0.86, critRate: 0.1, exp: 80, money: 0,
            skills: ["basic_fist"]
        }
    };
    GameData.stories = {
        "story_start": {
            id: "story_start",
            text: "青州·云来镇。\n你本是无名小卒，寄身于镇南的破旧客栈，替人跑腿打杂，混一口饱饭。\n这一日清晨，掌柜遣你出门采买，你整了整粗布衣，正要跨出门去。",
            choices: [
                { text: "出门采买", next: "story_street" },
                { text: "先在床上躺一会儿", next: "story_lazy" }
            ]
        },
        "story_lazy": {
            id: "story_lazy",
            text: "你又眯了一会儿，直到日上三竿。\n掌柜的骂骂咧咧地踢门而入：“小兔崽子！再不去采买，这个月的工钱别想要了！”\n你只好一骨碌爬起来，匆匆出门。",
            next: "story_street"
        },
        "story_street": {
            id: "story_street",
            text: "镇口的老槐树下，你撞见一幕：\n几个地痞正围着卖卤肉的老翁推搡叫骂，为首的大汉一脚踹翻了老人的摊子，卤肉滚了一地。\n老翁颤巍巍地抱着钱袋，连连作揖：“各位爷，小老儿真的没钱了……”",
            choices: [
                {
                    text: "出手相助",
                    next: "story_fight",
                    effect: [{ type: "battle", enemy: "gangster", win: "story_help_win", lose: "story_defeat" }]
                },
                { text: "明哲保身，绕道而行", next: "story_ignore" }
            ]
        },
        "story_fight": {
            id: "story_fight",
            text: "你大喝一声，冲上前去，挡在老翁身前。\n地痞们先是一愣，随即狞笑着围了上来。",
            effect: [{ type: "battle", enemy: "gangster", win: "story_help_win", lose: "story_defeat" }]
        },
        "story_defeat": {
            id: "story_defeat",
            text: "你终究双拳难敌四手，被揍得鼻青脸肿，昏迷过去。\n再醒来时，你已躺在客栈的柴房里，怀里的银两被顺走了不少。",
            effect: [
                { type: "money", value: -15 },
                { type: "heal", value: 30 },
                { type: "flag", value: "flag_beaten" }
            ],
            next: "story_street"
        },
        "story_help_win": {
            id: "story_help_win",
            text: "地痞们见讨不到便宜，骂骂咧咧地散了。\n老翁抹着泪千恩万谢，硬塞给你一包卤牛肉和几钱碎银：“小兄弟，拿着，这是老朽的一点心意。”",
            effect: [
                { type: "item", item: "beef", count: 1 },
                { type: "money", value: 30 },
                { type: "exp", value: 15 }
            ],
            choices: [
                { text: "前往镇外树林练功", next: "story_wild" },
                { text: "回客栈歇息", next: "story_rest" }
            ]
        },
        "story_ignore": {
            id: "story_ignore",
            text: "你低着头快步走过，假装没看见。\n身后传来老翁的痛呼与地痞的哄笑，你攥紧了拳头，心里堵得慌。\n(获得标志：胆怯)",
            effect: [{ type: "flag", value: "flag_coward" }],
            choices: [
                { text: "前往镇外树林散心", next: "story_wild" },
                { text: "回客栈歇息", next: "story_rest" }
            ]
        },
        "story_rest": {
            id: "story_rest",
            text: "你回到客栈，倒头便睡。\n翌日清晨，精力尽复。",
            effect: [
                { type: "heal", value: 9999 },
                { type: "mp", value: 9999 }
            ],
            choices: [
                { text: "前往镇外树林练功", next: "story_wild" },
                { text: "在镇上转转", next: "story_street" }
            ]
        },
        "story_wild": {
            id: "story_wild",
            text: "镇外树林幽深寂静，你正欲寻一处空地打拳，忽听草丛沙沙作响。\n一头灰毛野狼从树后探出，龇着牙，缓缓逼近。",
            effect: [{ type: "battle", enemy: "wolf", win: "story_wolf_win", lose: "story_wild_lose" }]
        },
        "story_wild_lose": {
            id: "story_wild_lose",
            text: "你被野狼咬得遍体鳞伤，拼死逃回镇里。\n郎中为你包扎伤口，银两又少了几许。",
            effect: [
                { type: "money", value: -10 },
                { type: "heal", value: 20 },
                { type: "flag", value: "flag_beaten" }
            ],
            next: "story_street"
        },
        "story_wolf_win": {
            id: "story_wolf_win",
            text: "野狼哀嚎一声，倒在了你的拳下。\n你在狼尸旁捡到一张完整的狼皮。",
            effect: [
                { type: "exp", value: 25 },
                { type: "item", item: "wolf_pelt", count: 1 }
            ],
            choices: [
                { text: "继续深入树林", next: "story_mountain" },
                { text: "回镇上卖狼皮", next: "story_street" }
            ]
        },
        "story_mountain": {
            id: "story_mountain",
            text: "你穿过树林，来到通往县城必经的山道。\n路旁草丛中忽地跳出三名持刀山贼，为首的汉子冷笑：“此山是我开，留下买路财！”",
            effect: [{ type: "battle", enemy: "bandit", win: "story_bandit_win", lose: "story_wild_lose" }]
        },
        "story_bandit_win": {
            id: "story_bandit_win",
            text: "山贼们抱头鼠窜。\n你从山贼身上搜出些碎银，又在道旁草丛里发现一株野山参。",
            effect: [
                { type: "money", value: 40 },
                { type: "exp", value: 40 },
                { type: "item", item: "gingseng", count: 1 }
            ],
            choices: [
                { text: "前往镇上的武馆学艺", next: "story_dojo" },
                { text: "回镇歇息", next: "story_rest" }
            ]
        },
        "story_dojo": {
            id: "story_dojo",
            text: "镇上武馆门口，教头抱臂而立，上下打量你：“想学拳？先接我三招，接得住，我便收你。”\n(需等级不低于 3，方可一搏)",
            choices: [
                {
                    text: "上前挑战教头",
                    next: "story_dojo_fight",
                    require: [{ type: "level", value: 3 }]
                },
                { text: "自忖不是对手，先回客栈", next: "story_rest" }
            ]
        },
        "story_dojo_fight": {
            id: "story_dojo_fight",
            text: "教头沉腰立马，拳风虎虎。\n你深吸一口气，迎上前去。",
            effect: [
                { type: "battle", enemy: "coach", win: "story_dojo_win", lose: "story_dojo_lose" }
            ]
        },
        "story_dojo_win": {
            id: "story_dojo_win",
            text: "教头收拳而立，眼中露出赞许之色：“好小子，是块练武的料！”\n他亲手将一柄木剑交到你手中，又授你太极剑法入门口诀。",
            effect: [
                { type: "skill", value: "taiji_sword" },
                { type: "item", item: "sword_wood", count: 1 },
                { type: "exp", value: 80 }
            ],
            choices: [
                { text: "在武馆后院继续练功", next: "story_rest" },
                { text: "出镇闯荡", next: "story_bandit_win" }
            ]
        },
        "story_dojo_lose": {
            id: "story_dojo_lose",
            text: "你被教头一记扫堂腿绊翻在地。\n教头摇摇头：“底子太差，回去再练练，明年再来吧。”",
            effect: [{ type: "heal", value: 20 }],
            next: "story_rest"
        }
    };
    WuXia.GameData = GameData;
})(WuXia || (WuXia = {}));
var WuXia;
(function (WuXia) {
    /** 存档管理：localStorage 持久化 */
    class SaveManager {
        static save(hero) {
            try {
                localStorage.setItem(SaveManager.SAVE_KEY, JSON.stringify(hero.toSave()));
            }
            catch (e) {
                console.error("[存档失败]", e);
            }
        }
        static load() {
            try {
                const raw = localStorage.getItem(SaveManager.SAVE_KEY);
                if (!raw)
                    return null;
                const data = JSON.parse(raw);
                return WuXia.Hero.fromSave(data);
            }
            catch (e) {
                console.error("[读档失败]", e);
                return null;
            }
        }
        static clear() {
            try {
                localStorage.removeItem(SaveManager.SAVE_KEY);
            }
            catch (e) {
                console.error("[清档失败]", e);
            }
        }
        static hasSave() {
            return !!localStorage.getItem(SaveManager.SAVE_KEY);
        }
    }
    SaveManager.SAVE_KEY = "wuxia_save_v1";
    WuXia.SaveManager = SaveManager;
})(WuXia || (WuXia = {}));
var WuXia;
(function (WuXia) {
    /** 主角 */
    class Hero {
        constructor() {
            this.name = "无名侠客";
            this.level = 1;
            this.exp = 0;
            /** 自由属性点 */
            this.freePoints = 0;
            this.hp = 100;
            this.mp = 50;
            this.money = 50;
            this.attrs = { strength: 5, body: 5, agility: 5, spirit: 5 };
            /** 已学武功 id 列表 */
            this.skills = [];
            /** 物品 id -> 数量 */
            this.items = {};
            /** 剧情标志 */
            this.flags = [];
            /** 当前所在剧情节点 */
            this.currentNode = "story_start";
            this.createdTime = 0;
            this.createdTime = Date.now();
        }
        hasFlag(flag) {
            return this.flags.indexOf(flag) >= 0;
        }
        addFlag(flag) {
            if (!this.hasFlag(flag))
                this.flags.push(flag);
        }
        hasItem(id, count) {
            const n = this.items[id] || 0;
            return count === undefined ? n > 0 : n >= count;
        }
        addItem(id, count) {
            this.items[id] = (this.items[id] || 0) + count;
        }
        removeItem(id, count) {
            const cur = this.items[id] || 0;
            const next = cur - count;
            if (next <= 0)
                delete this.items[id];
            else
                this.items[id] = next;
        }
        toSave() {
            return {
                name: this.name, level: this.level, exp: this.exp,
                freePoints: this.freePoints, hp: this.hp, mp: this.mp,
                money: this.money, attrs: Object.assign({}, this.attrs),
                skills: this.skills.slice(), items: Object.assign({}, this.items),
                flags: this.flags.slice(), currentNode: this.currentNode,
                createdTime: this.createdTime
            };
        }
        static fromSave(data) {
            var _a, _b, _c;
            const h = new Hero();
            if (!data)
                return h;
            h.name = data.name || h.name;
            h.level = data.level || 1;
            h.exp = data.exp || 0;
            h.freePoints = data.freePoints || 0;
            h.hp = (_a = data.hp) !== null && _a !== void 0 ? _a : h.hp;
            h.mp = (_b = data.mp) !== null && _b !== void 0 ? _b : h.mp;
            h.money = (_c = data.money) !== null && _c !== void 0 ? _c : 50;
            h.attrs = Object.assign({ strength: 5, body: 5, agility: 5, spirit: 5 }, data.attrs || {});
            h.skills = data.skills || [];
            h.items = data.items || {};
            h.flags = data.flags || [];
            h.currentNode = data.currentNode || "story_start";
            h.createdTime = data.createdTime || 0;
            return h;
        }
    }
    WuXia.Hero = Hero;
})(WuXia || (WuXia = {}));
var WuXia;
(function (WuXia) {
    /**
     * 网络通信层：基于 Laya.HttpRequest 的 Promise 封装
     * - baseUrl 为空串 = 纯离线模式（只读本地 GameData）
     * - baseUrl 赋值后 = 后端通信模式（远程数据优先，失败回退本地）
     */
    class ApiClient {
        static get online() {
            return this.baseUrl.length > 0;
        }
        /** GET 请求，responseType="json" 时自动解析为对象 */
        static get(path, timeout = 8000) {
            return this.request("get", path, null, timeout);
        }
        /** POST 请求，body 自动 JSON 序列化 */
        static post(path, data, timeout = 8000) {
            return this.request("post", path, data, timeout);
        }
        static request(method, path, data, timeout) {
            return new Promise((resolve, reject) => {
                const http = new Laya.HttpRequest();
                let settled = false;
                const timer = setTimeout(() => {
                    if (!settled) {
                        settled = true;
                        reject(new Error(`请求超时: ${path}`));
                    }
                }, timeout);
                http.once(Laya.Event.COMPLETE, this, (res) => {
                    if (settled)
                        return;
                    settled = true;
                    clearTimeout(timer);
                    resolve(res);
                });
                http.once(Laya.Event.ERROR, this, (msg) => {
                    if (settled)
                        return;
                    settled = true;
                    clearTimeout(timer);
                    reject(new Error(String(msg) || `请求失败: ${path}`));
                });
                const body = data != null ? JSON.stringify(data) : null;
                http.send(this.baseUrl + path, body, method, "json", ["Content-Type", "application/json"]);
            });
        }
    }
    /** 后端地址，例如 "http://localhost:3000/api"。留空表示离线 */
    ApiClient.baseUrl = "";
    WuXia.ApiClient = ApiClient;
})(WuXia || (WuXia = {}));
var WuXia;
(function (WuXia) {
    /**
     * 剧情数据源：远程优先，本地兜底，带内存缓存
     * - 后端开启时：GET /api/story/:id 拉取节点 JSON
     * - 后端失败/离线时：回退 GameData 本地静态数据
     * 类型契约：远端返回的 JSON 必须符合 StoryNode 结构
     */
    class StorySource {
        /** 获取剧情节点（并发去重） */
        static get(id) {
            if (this.cache[id])
                return Promise.resolve(this.cache[id]);
            if (this.loading[id])
                return this.loading[id];
            const p = WuXia.ApiClient.online
                ? this.fromRemote(id)
                : Promise.resolve(this.fromLocal(id));
            this.loading[id] = p;
            // target=ES2017，用 then 做清理而非 finally
            p.then(() => { delete this.loading[id]; }, () => { delete this.loading[id]; });
            return p;
        }
        static fromRemote(id) {
            return WuXia.ApiClient.get("/api/story/" + encodeURIComponent(id))
                .then((node) => {
                this.cache[id] = node;
                return node;
            })
                .catch((err) => {
                console.warn("[StorySource] 远端剧情拉取失败，回退本地:", id, err);
                return this.fromLocal(id);
            });
        }
        static fromLocal(id) {
            const node = WuXia.GameData.getStory(id) || null;
            if (node)
                this.cache[id] = node;
            return node;
        }
        /** 清空缓存（切换账号/刷新远端版本时调用） */
        static clearCache() {
            this.cache = {};
        }
    }
    StorySource.cache = {};
    StorySource.loading = {};
    WuXia.StorySource = StorySource;
})(WuXia || (WuXia = {}));
var WuXia;
(function (WuXia) {
    /** 战斗中的敌人实例 */
    class BattleEnemy {
        constructor(data, levelScale) {
            this.data = data;
            this.hp = Math.round(data.hp * levelScale);
            this.mp = data.mp;
        }
    }
    /** 回合制战斗框架 */
    class BattleSystem {
        constructor(hero, ui) {
            this.enemy = null;
            this.enemyScale = 1;
            this.onEnd = null;
            this.guarding = false;
            this.hero = hero;
            this.ui = ui;
        }
        get running() {
            return this.enemy !== null;
        }
        /** 开始战斗，levelScale 用于按玩家等级微调敌人强度 */
        start(enemyId, onEnd, levelScale) {
            const data = WuXia.GameData.getEnemy(enemyId);
            if (!data) {
                this.ui.log(`[错误] 未找到敌人：${enemyId}`, "#ff5555");
                return;
            }
            this.onEnd = onEnd;
            this.enemyScale = levelScale || 1;
            this.enemy = new BattleEnemy(data, this.enemyScale);
            this.guarding = false;
            const e = this.enemy.data;
            this.ui.log("─── 战斗开始 ───", "#e8c86a");
            this.ui.log(`${e.name}：${e.desc}`, "#d8c8a0");
            this.ui.log(`${e.name} 气血 ${this.enemy.hp} / ${Math.round(e.hp * this.enemyScale)}，攻击 ${e.attack}，防御 ${e.defense}`, "#d8c8a0");
            this.ui.refreshStatus(this.hero);
            this.showActions();
        }
        /** 展示玩家行动选项 */
        showActions() {
            if (!this.enemy)
                return;
            const enemy = this.enemy;
            const actions = [];
            actions.push({ text: "⚔ 攻击", handler: () => this.playerAttack(undefined) });
            actions.push({ text: "🛡 防御", handler: () => this.playerGuard() });
            // 可用的外功
            for (const id of this.hero.skills) {
                const s = WuXia.GameData.getSkill(id);
                if (!s || s.type !== "attack")
                    continue;
                const mpCost = s.mpCost;
                const text = `${s.name}（内力 ${mpCost}）`;
                if (this.hero.mp < mpCost) {
                    actions.push({ text: `✖ ${s.name}(内力不足)`, handler: () => this.ui.log("内力不足，无法施展。", "#ff8888") });
                }
                else {
                    actions.push({ text: `★ ${s.name}（威力 ${s.power}）`, handler: () => this.playerAttack(id) });
                }
            }
            actions.push({ text: "🏃 逃跑", handler: () => this.playerFlee() });
            this.ui.showChoices(actions);
        }
        /** 玩家普通攻击或施展武功 */
        playerAttack(skillId) {
            if (!this.enemy)
                return;
            const e = this.enemy;
            let power = 0, mpCost = 0, skillName = "普通攻击";
            if (skillId) {
                const s = WuXia.GameData.getSkill(skillId);
                if (!s)
                    return;
                if (this.hero.mp < s.mpCost) {
                    this.ui.log("内力不足，无法施展。", "#ff8888");
                    this.showActions();
                    return;
                }
                this.hero.mp -= s.mpCost;
                power = s.power;
                skillName = s.name;
                this.ui.log(`你施展【${s.name}】！`, "#7ec8ff");
            }
            else {
                this.ui.log("你欺身而上，挥拳攻向对方。", "#d8c8a0");
            }
            const hit = Math.random() < WuXia.GrowthSystem.hitRate(this.hero) - this.dodgeRateOf(e);
            if (!hit) {
                this.ui.log(`${e.data.name} 侧身避开了你的攻击！`, "#a0a0a0");
            }
            else {
                const crit = Math.random() < WuXia.GrowthSystem.critRate(this.hero);
                let dmg = (WuXia.GrowthSystem.attack(this.hero) + power) - e.data.defense * 0.6;
                dmg = Math.max(1, dmg * (0.9 + Math.random() * 0.2));
                if (crit)
                    dmg *= 1.8;
                dmg = Math.round(dmg);
                e.hp -= dmg;
                const critTag = crit ? "　(暴击!)" : "";
                this.ui.log(`你对${e.data.name}造成 ${dmg} 点伤害${critTag}`, crit ? "#ffcc44" : "#ff9966");
                if (e.hp <= 0) {
                    this.ui.log(`${e.data.name} 倒下了！`, "#66ff99");
                    this.endBattle(true);
                    return;
                }
            }
            this.enemyTurn();
        }
        playerGuard() {
            this.ui.log("你凝神戒备，气沉丹田，准备抵挡对方的攻势。", "#7ec8ff");
            this.guarding = true;
            this.enemyTurn();
        }
        playerFlee() {
            if (!this.enemy)
                return;
            const chance = 0.5 + (this.hero.attrs.agility - this.enemy.data.agility) * 0.04;
            if (Math.random() < Math.max(0.3, Math.min(0.95, chance))) {
                this.ui.log("你且战且退，觅得空隙，转身逃出了战圈。", "#a0a0a0");
                this.endBattle(false, true);
            }
            else {
                this.ui.log("对方紧咬不放，你没能脱身！", "#ff8888");
                this.enemyTurn();
            }
        }
        /** 敌人回合 */
        enemyTurn() {
            if (!this.enemy)
                return;
            const e = this.enemy;
            const heroDef = WuXia.GrowthSystem.defense(this.hero);
            // 敌人技能（如果有 mp 且概率触发）
            let atk = e.data.attack;
            let skillName = "";
            const usable = (e.data.skills || []).filter(id => {
                const s = WuXia.GameData.getSkill(id);
                return s && s.type === "attack" && e.mp >= s.mpCost;
            });
            if (usable.length > 0 && Math.random() < 0.4) {
                const s = WuXia.GameData.getSkill(usable[0]);
                e.mp -= s.mpCost;
                atk += s.power;
                skillName = s.name;
                this.ui.log(`${e.data.name} 施展【${s.name}】！`, "#ff9c6a");
            }
            const guardBonus = this.guarding ? 6 : 0;
            this.guarding = false;
            const hit = Math.random() < e.data.hitRate + e.data.agility * 0.008 - WuXia.GrowthSystem.dodgeRate(this.hero);
            if (!hit) {
                this.ui.log(`${e.data.name} 的攻击落空了！`, "#a0a0a0");
            }
            else {
                const crit = Math.random() < e.data.critRate;
                let dmg = (atk + (skillName ? 0 : 0)) - (heroDef + guardBonus) * 0.6;
                dmg = Math.max(1, dmg * (0.9 + Math.random() * 0.2));
                if (crit)
                    dmg *= 1.8;
                dmg = Math.round(dmg);
                this.hero.hp -= dmg;
                this.ui.log(`${e.data.name} 对你造成 ${dmg} 点伤害${crit ? "　(暴击!)" : ""}`, "#ff5555");
                if (this.hero.hp <= 0) {
                    this.hero.hp = 0;
                    this.ui.log("你眼前一黑，倒了下去……", "#ff5555");
                    this.endBattle(false);
                    return;
                }
            }
            this.ui.refreshStatus(this.hero);
            this.showActions();
        }
        dodgeRateOf(e) {
            return Math.min(0.4, e.data.agility * 0.02);
        }
        /** 结算战斗：win=true 玩家胜利 */
        endBattle(win, fled = false) {
            if (!this.enemy)
                return;
            const e = this.enemy;
            const drops = [];
            if (win) {
                const gainExp = Math.round(e.data.exp * this.enemyScale);
                const tips = WuXia.GrowthSystem.gainExp(this.hero, gainExp);
                this.hero.money += e.data.money;
                this.ui.log(`战斗胜利！获得 ${gainExp} 经验、${e.data.money} 银两。`, "#66ff99");
                for (const t of tips)
                    this.ui.log(t, "#66ff99");
                // 掉落
                if (e.data.drops) {
                    for (const d of e.data.drops) {
                        if (Math.random() < d.chance) {
                            const n = d.count || 1;
                            this.hero.addItem(d.item, n);
                            const it = WuXia.GameData.getItem(d.item);
                            drops.push(d.item);
                            this.ui.log(`从${e.data.name}身上获得了【${it ? it.name : d.item}】x${n}`, "#66ff99");
                        }
                    }
                }
            }
            else if (fled) {
                this.ui.log("战斗结束。", "#a0a0a0");
            }
            this.ui.log("─── 战斗结束 ───", "#e8c86a");
            const cb = this.onEnd;
            const enemyData = this.enemy.data;
            this.enemy = null;
            this.onEnd = null;
            this.ui.refreshStatus(this.hero);
            this.ui.clearChoices();
            if (cb)
                cb(win, drops);
        }
        /** 战斗中玩家输入指令，返回是否被消费 */
        handleInput(cmd) {
            if (!this.enemy)
                return false;
            const c = cmd.trim().toLowerCase();
            const words = c.split(/\s+/);
            const first = words[0];
            if (first === "attack" || first === "攻击" || first === "a") {
                this.playerAttack(undefined);
            }
            else if (first === "guard" || first === "防御" || first === "d") {
                this.playerGuard();
            }
            else if (first === "flee" || first === "逃跑" || first === "run") {
                this.playerFlee();
            }
            else if (first === "skill" || first === "武功") {
                // 通过按钮选择即可
                this.ui.log("请点击下方按钮选择施展的武功。", "#a0a0a0");
            }
            else if (/^\d+$/.test(c)) {
                // 数字：对应武功序号
                const attacks = this.hero.skills
                    .map(id => WuXia.GameData.getSkill(id))
                    .filter((s) => !!s && s.type === "attack");
                const idx = parseInt(c, 10) - 1;
                if (idx >= 0 && idx < attacks.length) {
                    this.playerAttack(attacks[idx].id);
                }
                else {
                    this.ui.log("无效的武功序号。", "#ff8888");
                }
            }
            else {
                this.ui.log(`战斗中可输入：攻击 / 防御 / 逃跑，或点击按钮行动。`, "#a0a0a0");
            }
            return true;
        }
    }
    WuXia.BattleSystem = BattleSystem;
})(WuXia || (WuXia = {}));
var WuXia;
(function (WuXia) {
    /** 属性养成框架：升级 / 加点 / 派生属性 / 修炼 */
    class GrowthSystem {
        /** 升级所需经验 = 等级 * 等级 * 80 + 60 */
        static expNeed(level) {
            return level * level * 80 + 60;
        }
        /** 增加经验，自动处理连续升级；返回提示行 */
        static gainExp(hero, amount) {
            const tips = [];
            hero.exp += amount;
            tips.push(`获得 ${amount} 点经验。`);
            while (hero.exp >= GrowthSystem.expNeed(hero.level)) {
                hero.exp -= GrowthSystem.expNeed(hero.level);
                hero.level++;
                hero.freePoints += 3;
                // 升级时按成长回满一部分气血内力
                hero.hp = Math.min(hero.hp + 30, GrowthSystem.maxHp(hero));
                hero.mp = Math.min(hero.mp + 15, GrowthSystem.maxMp(hero));
                tips.push(`—— 等级提升至 ${hero.level} 级！获得 3 点自由属性点。`);
            }
            return tips;
        }
        /** 分配自由属性点 */
        static addPoint(hero, key) {
            if (hero.freePoints <= 0)
                return false;
            hero.attrs[key]++;
            hero.freePoints--;
            return true;
        }
        /** 学习武功 */
        static learnSkill(hero, skillId) {
            const s = WuXia.GameData.getSkill(skillId);
            if (!s || hero.skills.indexOf(skillId) >= 0)
                return false;
            hero.skills.push(skillId);
            return true;
        }
        static hasSkill(hero, skillId) {
            return hero.skills.indexOf(skillId) >= 0;
        }
        /** 已修习内功叠加的四维加成 */
        static innerBonus(hero) {
            const b = { strength: 0, body: 0, agility: 0, spirit: 0 };
            for (const id of hero.skills) {
                const s = WuXia.GameData.getSkill(id);
                if (s && s.type === "inner" && s.attrBonus) {
                    b.strength += s.attrBonus.strength || 0;
                    b.body += s.attrBonus.body || 0;
                    b.agility += s.attrBonus.agility || 0;
                    b.spirit += s.attrBonus.spirit || 0;
                }
            }
            return b;
        }
        static maxHp(hero) {
            return 100 + (hero.attrs.body + GrowthSystem.innerBonus(hero).body) * 20;
        }
        static maxMp(hero) {
            return 50 + (hero.attrs.spirit + GrowthSystem.innerBonus(hero).spirit) * 12;
        }
        static attack(hero) {
            return 8 + (hero.attrs.strength + GrowthSystem.innerBonus(hero).strength) * 3;
        }
        static defense(hero) {
            return 4 + (hero.attrs.body + GrowthSystem.innerBonus(hero).body) * 2;
        }
        static hitRate(hero) {
            const a = hero.attrs.agility + GrowthSystem.innerBonus(hero).agility;
            return Math.min(0.97, 0.82 + a * 0.012);
        }
        static critRate(hero) {
            const a = hero.attrs.agility + GrowthSystem.innerBonus(hero).agility;
            return Math.min(0.4, 0.03 + a * 0.008);
        }
        /** 闪避率：相对对手命中率计算 */
        static dodgeRate(hero) {
            const a = hero.attrs.agility + GrowthSystem.innerBonus(hero).agility;
            return Math.min(0.4, a * 0.02);
        }
        /** 使用消耗品（可食用物品） */
        static useItem(hero, itemId) {
            const it = WuXia.GameData.getItem(itemId);
            if (!it)
                return null;
            if (!hero.hasItem(itemId))
                return "你没有这件物品。";
            if (!it.healHp && !it.healMp)
                return `${it.name} 似乎不能直接食用。`;
            hero.removeItem(itemId, 1);
            if (it.healHp)
                hero.hp = Math.min(hero.hp + it.healHp, GrowthSystem.maxHp(hero));
            if (it.healMp)
                hero.mp = Math.min(hero.mp + it.healMp, GrowthSystem.maxMp(hero));
            return `服用了【${it.name}】，${it.healHp ? "气血 +" + it.healHp + "，" : ""}${it.healMp ? "内力 +" + it.healMp : ""}`.replace(/，$/g, "");
        }
        /** 打坐恢复（按内息） */
        static meditate(hero) {
            const gain = 20 + hero.attrs.spirit * 3;
            hero.hp = Math.min(hero.hp + gain, GrowthSystem.maxHp(hero));
            hero.mp = Math.min(hero.mp + gain * 0.8, GrowthSystem.maxMp(hero));
            return `你盘膝打坐，调息片刻。气血 +${Math.round(gain)}，内力 +${Math.round(gain * 0.8)}。`;
        }
    }
    WuXia.GrowthSystem = GrowthSystem;
})(WuXia || (WuXia = {}));
var WuXia;
(function (WuXia) {
    /** 节点式剧情框架：条件判定 / 效果应用 / 战斗挂起 */
    class StorySystem {
        constructor(hero, ui, battle) {
            this.pendingNode = null;
            this.hero = hero;
            this.ui = ui;
            this.battle = battle;
        }
        /** 进入剧情节点（异步加载：远程优先，本地兜底） */
        enter(nodeId) {
            WuXia.StorySource.get(nodeId).then((node) => {
                if (!node) {
                    this.ui.log(`[错误] 剧情节点不存在：${nodeId}`, "#ff5555");
                    return;
                }
                this.hero.currentNode = nodeId;
                this.ui.log("────────────────────────", "#6a6a6a");
                this.ui.log(node.text, "#e8e0cc");
                this.applyEffects(node.effect || []);
                if (this.pendingNode) {
                    // 战斗效果已挂起，等待战斗结束
                    return;
                }
                this.showChoices(node);
            });
        }
        /** 显示节点选项（过滤不满足条件的） */
        showChoices(node) {
            const choices = [];
            const nodeChoices = node.choices || [];
            for (let i = 0; i < nodeChoices.length; i++) {
                const ch = nodeChoices[i];
                const req = this.checkConditions(ch.require);
                if (!req.ok) {
                    choices.push({
                        text: `✖ ${ch.text}（${req.reason}）`,
                        handler: () => this.ui.log(`条件不足：${req.reason}`, "#888888")
                    });
                    continue;
                }
                const index = i;
                choices.push({
                    text: ch.text,
                    handler: () => {
                        this.applyEffects(ch.effect || []);
                        if (this.pendingNode)
                            return;
                        this.enter(ch.next);
                    }
                });
            }
            if (choices.length > 0) {
                this.ui.showChoices(choices);
            }
            else if (node.next) {
                this.enter(node.next);
            }
            else {
                this.ui.clearChoices();
                this.ui.setInputHint("剧情已到尽头。输入 help 查看可用指令。");
            }
        }
        /** 应用剧情效果；若触发战斗则挂起 */
        applyEffects(effects) {
            for (const ef of effects) {
                switch (ef.type) {
                    case "exp": {
                        const tips = WuXia.GrowthSystem.gainExp(this.hero, ef.value);
                        this.ui.log(`获得 ${ef.value} 点经验。`, "#66ff99");
                        for (const t of tips.slice(1))
                            this.ui.log(t, "#66ff99");
                        break;
                    }
                    case "money":
                        if (ef.value >= 0) {
                            this.hero.money += ef.value;
                            this.ui.log(`获得 ${ef.value} 银两。`, "#ffd966");
                        }
                        else {
                            this.hero.money = Math.max(0, this.hero.money + ef.value);
                            this.ui.log(`失去 ${-ef.value} 银两。`, "#ff8888");
                        }
                        break;
                    case "item": {
                        const it = WuXia.GameData.getItem(ef.item);
                        const n = ef.count || 1;
                        this.hero.addItem(ef.item, n);
                        this.ui.log(`获得【${it ? it.name : ef.item}】x${n}`, "#66ff99");
                        break;
                    }
                    case "heal":
                        this.hero.hp = Math.min(WuXia.GrowthSystem.maxHp(this.hero), this.hero.hp + ef.value);
                        this.ui.log(`气血恢复了 ${ef.value} 点。`, "#7ec8ff");
                        break;
                    case "mp":
                        this.hero.mp = Math.min(WuXia.GrowthSystem.maxMp(this.hero), this.hero.mp + ef.value);
                        this.ui.log(`内力恢复了 ${ef.value} 点。`, "#7ec8ff");
                        break;
                    case "flag":
                        this.hero.addFlag(ef.value);
                        break;
                    case "skill": {
                        const s = WuXia.GameData.getSkill(ef.value);
                        if (s && WuXia.GrowthSystem.learnSkill(this.hero, ef.value)) {
                            this.ui.log(`你学会了武功【${s.name}】！${s.type === "inner" ? "（内功被动生效）" : ""}`, "#ffcc44");
                        }
                        break;
                    }
                    case "attribute": {
                        this.hero.attrs[ef.key] += ef.value;
                        const names = {
                            strength: "膂力", body: "体魄", agility: "身法", spirit: "内息"
                        };
                        this.ui.log(`${names[ef.key]} ${ef.value > 0 ? "+" : ""}${ef.value}。`, "#ffcc44");
                        break;
                    }
                    case "battle": {
                        // 挂起剧情，进入战斗；战斗结束后再进入对应节点
                        this.pendingNode = ef.win;
                        const loseNode = ef.lose;
                        const ui = this.ui;
                        this.battle.start(ef.enemy, (win) => {
                            const next = win ? ef.win : loseNode;
                            ui.log("", "");
                            this.pendingNode = null;
                            this.enter(next);
                        });
                        return; // 效果应用到此暂停
                    }
                    case "next":
                        this.pendingNode = null;
                        this.enter(ef.value);
                        return;
                }
            }
            this.ui.refreshStatus(this.hero);
        }
        /** 条件判定 */
        checkConditions(conds) {
            if (!conds || conds.length === 0)
                return { ok: true, reason: "" };
            for (const c of conds) {
                switch (c.type) {
                    case "level":
                        if (this.hero.level < c.value)
                            return { ok: false, reason: `需要 ${c.value} 级` };
                        break;
                    case "flag":
                        if (!this.hero.hasFlag(c.value))
                            return { ok: false, reason: `需要标志 ${c.value}` };
                        break;
                    case "item": {
                        const it = WuXia.GameData.getItem(c.item);
                        const need = c.count || 1;
                        if (!this.hero.hasItem(c.item, need))
                            return { ok: false, reason: `需要${it ? it.name : c.item} x${need}` };
                        break;
                    }
                    case "money":
                        if (this.hero.money < c.value)
                            return { ok: false, reason: `需要 ${c.value} 银两` };
                        break;
                    case "skill": {
                        const s = WuXia.GameData.getSkill(c.value);
                        if (!WuXia.GrowthSystem.hasSkill(this.hero, c.value))
                            return { ok: false, reason: `需要学会${s ? s.name : c.value}` };
                        break;
                    }
                }
            }
            return { ok: true, reason: "" };
        }
    }
    WuXia.StorySystem = StorySystem;
})(WuXia || (WuXia = {}));
var WuXia;
(function (WuXia) {
    /** 界面层：标题栏 / 日志区 / 选项按钮 / 输入框 */
    class GameUI {
        constructor(onCommand) {
            this.logRows = [];
            this.totalH = 0;
            this.choiceButtons = [];
            this.onCommand = onCommand;
            this.build();
        }
        // ───────────────── 构建界面 ─────────────────
        build() {
            const stage = Laya.stage;
            // 背景
            const bg = new Laya.Sprite();
            bg.graphics.drawRect(0, 0, 960, 640, "#17171e");
            stage.addChild(bg);
            // 标题栏
            const bar = new Laya.Sprite();
            bar.graphics.drawRect(0, 0, 960, 52, "#23232e");
            stage.addChild(bar);
            const title = this.makeText("⚔ 文字江湖", "#e8c86a", 24, true);
            title.pos(16, 12);
            bar.addChild(title);
            this.stName = this.makeText("", "#ffffff", 20, true);
            this.stName.pos(240, 15);
            bar.addChild(this.stName);
            this.stHp = this.makeText("", "#7fe08a", 20);
            this.stHp.pos(430, 15);
            bar.addChild(this.stHp);
            this.stMp = this.makeText("", "#7ec8ff", 20);
            this.stMp.pos(580, 15);
            bar.addChild(this.stMp);
            this.stMoney = this.makeText("", "#ffd966", 20);
            this.stMoney.pos(730, 15);
            bar.addChild(this.stMoney);
            this.stPoints = this.makeText("", "#ff9c6a", 20);
            this.stPoints.pos(850, 15);
            bar.addChild(this.stPoints);
            // 日志视口
            this.logView = new Laya.Sprite();
            this.logView.graphics.drawRect(0, 0, GameUI.LOG_W, GameUI.LOG_H, "#101015");
            this.logView.graphics.drawRect(0, 0, GameUI.LOG_W, GameUI.LOG_H, null, "#2a2a35", 1);
            this.logView.pos(12, 62);
            stage.addChild(this.logView);
            // 用 mask 裁剪日志内容
            const mask = new Laya.Sprite();
            mask.graphics.drawRect(0, 0, GameUI.LOG_W, GameUI.LOG_H, "#000000");
            this.logView.mask = mask;
            this.logContent = new Laya.Sprite();
            this.logView.addChild(this.logContent);
            // 选项按钮区
            this.choiceBox = new Laya.Sprite();
            this.choiceBox.pos(12, 492);
            stage.addChild(this.choiceBox);
            // 输入区
            const inputBg = new Laya.Sprite();
            inputBg.graphics.drawRect(0, 0, 936, 44, "#1d1d26");
            inputBg.graphics.drawRect(0, 0, 936, 44, null, "#2a2a35", 1);
            inputBg.pos(12, 586);
            stage.addChild(inputBg);
            this.input = new Laya.Input();
            this.input.font = GameUI.FONT;
            this.input.fontSize = 20;
            this.input.color = "#e8e8e8";
            this.input.prompt = "输入指令，回车或点击发送";
            this.input.promptColor = "#666677";
            this.input.type = "text";
            this.input.size(700, 40);
            this.input.pos(16, 592);
            this.input.on(Laya.Event.KEY_DOWN, this, this.onInputKey);
            stage.addChild(this.input);
            this.sendBtn = this.makeButton("发送", 200, 36, () => this.doSend());
            this.sendBtn.pos(732, 590);
            stage.addChild(this.sendBtn);
            // 引导提示
            this.log("欢迎来到【文字江湖】—— 一款文字武侠冒险小游戏。", "#e8c86a");
            this.log("输入 help 查看可用指令；剧情中直接点击选项按钮推进故事。", "#a0a0a0");
        }
        makeText(t, color, size, bold = false) {
            const tx = new Laya.Text();
            tx.text = t;
            tx.font = GameUI.FONT;
            tx.fontSize = size;
            tx.color = color;
            tx.bold = bold;
            return tx;
        }
        makeButton(text, w, h, handler) {
            const btn = new Laya.Sprite();
            btn.size(w, h);
            btn.graphics.drawRect(0, 0, w, h, "#3a3a4a");
            btn.graphics.drawRect(0, 0, w, h, null, "#55556a", 1);
            const label = this.makeText(text, "#e8e0cc", 20, true);
            label.align = "center";
            label.size(w, h);
            label.pos(0, (h - 24) / 2);
            btn.addChild(label);
            btn.on(Laya.Event.CLICK, this, handler);
            btn.on(Laya.Event.MOUSE_DOWN, this, () => {
                btn.graphics.clear();
                btn.graphics.drawRect(0, 0, w, h, "#4a4a5e");
                btn.graphics.drawRect(0, 0, w, h, null, "#66667c", 1);
            });
            btn.on(Laya.Event.MOUSE_UP, this, () => {
                btn.graphics.clear();
                btn.graphics.drawRect(0, 0, w, h, "#3a3a4a");
                btn.graphics.drawRect(0, 0, w, h, null, "#55556a", 1);
            });
            return btn;
        }
        // ───────────────── 日志输出 ─────────────────
        log(text, color) {
            if (text === "") {
                this.log("　", "#2a2a2a");
                return;
            }
            const tx = new Laya.Text();
            tx.text = text;
            tx.font = GameUI.FONT;
            tx.fontSize = 22;
            tx.color = color || "#d8d0c0";
            tx.wordWrap = true;
            tx.width = GameUI.LOG_W - 16;
            tx.pos(8, this.totalH);
            this.logContent.addChild(tx);
            const h = tx.textHeight + 6;
            this.logRows.push(tx);
            this.totalH += h;
            // 限制行数，防止内存膨胀
            while (this.logRows.length > GameUI.MAX_ROWS) {
                const old = this.logRows.shift();
                this.totalH -= old.textHeight + 6;
                this.logContent.removeChild(old);
            }
            this.scrollToBottom();
        }
        scrollToBottom() {
            if (this.totalH > GameUI.LOG_H) {
                this.logContent.y = GameUI.LOG_H - this.totalH;
            }
            else {
                this.logContent.y = 0;
            }
        }
        // ───────────────── 选项按钮 ─────────────────
        showChoices(choices) {
            this.clearChoices();
            if (choices.length === 0)
                return;
            const gap = 8;
            const btnH = 38;
            const perRow = Math.max(2, Math.min(4, Math.ceil(choices.length / 2)));
            const btnW = (GameUI.LOG_W - (perRow - 1) * gap) / perRow;
            choices.forEach((c, i) => {
                const row = Math.floor(i / perRow);
                const col = i % perRow;
                const btn = this.makeButton(c.text, btnW, btnH, c.handler);
                btn.pos(col * (btnW + gap), row * (btnH + 8));
                this.choiceBox.addChild(btn);
                this.choiceButtons.push(btn);
            });
        }
        clearChoices() {
            for (const b of this.choiceButtons) {
                this.choiceBox.removeChild(b);
            }
            this.choiceButtons.length = 0;
        }
        // ───────────────── 状态栏 ─────────────────
        refreshStatus(hero) {
            const maxHp = WuXia.GrowthSystem.maxHp(hero);
            const maxMp = WuXia.GrowthSystem.maxMp(hero);
            this.stName.text = `${hero.name}  Lv.${hero.level}`;
            this.stHp.text = `气血 ${hero.hp}/${maxHp}`;
            this.stMp.text = `内力 ${hero.mp}/${maxMp}`;
            this.stMoney.text = `银两 ${hero.money}`;
            this.stPoints.text = hero.freePoints > 0 ? `属性点 ${hero.freePoints}` : "";
        }
        setInputHint(hint) {
            this.input.prompt = hint;
        }
        // ───────────────── 输入处理 ─────────────────
        onInputKey(ev) {
            if (ev.keyCode === 13) {
                this.doSend();
            }
        }
        doSend() {
            const cmd = this.input.text.trim();
            if (!cmd)
                return;
            this.input.text = "";
            this.onCommand(cmd);
        }
        destroy() {
            this.logView.mask = null;
        }
    }
    GameUI.LOG_W = 920;
    GameUI.LOG_H = 420;
    GameUI.MAX_ROWS = 120;
    GameUI.FONT = "Microsoft YaHei";
    WuXia.GameUI = GameUI;
})(WuXia || (WuXia = {}));
//# sourceMappingURL=bundle.js.map