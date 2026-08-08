import type { EnemyData, ItemData, SkillData, StoryNode } from "../model/Hero";

    /** 静态配置数据：物品 / 武功 / 敌人 / 剧情 */
    export class GameData {
        static items: { [id: string]: ItemData } = {
            "beef": { id: "beef", name: "卤牛肉", desc: "老翁相赠的卤牛肉，吃下可恢复气血。", healHp: 40 },
            "gingseng": { id: "gingseng", name: "野山参", desc: "山中偶得的野山参，服之恢复气血内力。", healHp: 80, healMp: 40 },
            "wolf_pelt": { id: "wolf_pelt", name: "狼皮", desc: "质地坚韧的狼皮，可在镇上换些银两。" },
            "sword_wood": { id: "sword_wood", name: "木剑", desc: "武馆教头所赠的木剑，聊胜于无。" }
        };

        static skills: { [id: string]: SkillData } = {
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

        static enemies: { [id: string]: EnemyData } = {
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

        static stories: { [id: string]: StoryNode } = {
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

        /** 获取武功 */
        static getSkill(id: string): SkillData | undefined {
            return GameData.skills[id];
        }
        /** 获取敌人 */
        static getEnemy(id: string): EnemyData | undefined {
            return GameData.enemies[id];
        }
        /** 获取物品 */
        static getItem(id: string): ItemData | undefined {
            return GameData.items[id];
        }
        /** 获取剧情节点 */
        static getStory(id: string): StoryNode | undefined {
            return GameData.stories[id];
        }
    }
