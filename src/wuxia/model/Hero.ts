    /** 基础四维属性 */
    export interface HeroAttributes {
        /** 膂力：影响攻击 */
        strength: number;
        /** 体魄：影响气血上限与防御 */
        body: number;
        /** 身法：影响命中 / 闪避 / 暴击 */
        agility: number;
        /** 内息：影响内力上限与修炼效率 */
        spirit: number;
    }

    /** 武功类型：inner=内功(被动加成)，attack=外功(战斗中主动施展) */
    export type SkillType = "inner" | "attack";

    /** 武功配置 */
    export interface SkillData {
        id: string;
        name: string;
        type: SkillType;
        desc: string;
        /** 外功威力(伤害加成百分比)，内功不使用 */
        power: number;
        /** 施展消耗内力 */
        mpCost: number;
        /** 学习所需等级 */
        requireLevel: number;
        /** 内功被动四维加成 */
        attrBonus?: Partial<HeroAttributes>;
    }

    /** 敌人配置 */
    export interface EnemyDrop {
        item: string;
        chance: number;
        count?: number;
    }
    export interface EnemyData {
        id: string;
        name: string;
        desc: string;
        level: number;
        hp: number;
        mp: number;
        attack: number;
        defense: number;
        agility: number;
        /** 基础命中率(0~1) */
        hitRate: number;
        /** 暴击率(0~1) */
        critRate: number;
        exp: number;
        money: number;
        drops?: EnemyDrop[];
        /** 敌人可施展的武功 id */
        skills?: string[];
    }

    /** 剧情效果：进入节点 / 选择选项时触发 */
    export type StoryEffect =
        | { type: "exp"; value: number }
        | { type: "money"; value: number }
        | { type: "item"; item: string; count?: number }
        | { type: "heal"; value: number }
        | { type: "mp"; value: number }
        | { type: "flag"; value: string }
        | { type: "skill"; value: string }
        | { type: "attribute"; key: keyof HeroAttributes; value: number }
        | { type: "battle"; enemy: string; win: string; lose: string }
        | { type: "next"; value: string };

    /** 剧情条件 */
    export type StoryCondition =
        | { type: "level"; value: number }
        | { type: "flag"; value: string }
        | { type: "item"; item: string; count?: number }
        | { type: "money"; value: number }
        | { type: "skill"; value: string };

    /** 剧情选项 */
    export interface StoryChoice {
        text: string;
        next: string;
        require?: StoryCondition[];
        effect?: StoryEffect[];
    }

    /** 剧情节点 */
    export interface StoryNode {
        id: string;
        text: string;
        choices?: StoryChoice[];
        effect?: StoryEffect[];
        /** 无选项时自动跳转 */
        next?: string;
    }

    /** 物品配置 */
    export interface ItemData {
        id: string;
        name: string;
        desc: string;
        /** 是否可食用(战斗中/闲时恢复) */
        healHp?: number;
        healMp?: number;
    }

    /** UI 接口：系统层与界面层解耦 */
    export interface IGameUI {
        log(text: string, color?: string): void;
        showChoices(choices: { text: string; handler: () => void }[]): void;
        clearChoices(): void;
        refreshStatus(hero: Hero): void;
        setInputHint(hint: string): void;
    }

    /** 主角 */
    export class Hero {
        name: string = "无名侠客";
        level: number = 1;
        exp: number = 0;
        /** 自由属性点 */
        freePoints: number = 0;
        hp: number = 100;
        mp: number = 50;
        money: number = 50;
        attrs: HeroAttributes = { strength: 5, body: 5, agility: 5, spirit: 5 };
        /** 已学武功 id 列表 */
        skills: string[] = [];
        /** 物品 id -> 数量 */
        items: { [id: string]: number } = {};
        /** 剧情标志 */
        flags: string[] = [];
        /** 当前所在剧情节点 */
        currentNode: string = "story_start";
        createdTime: number = 0;

        constructor() {
            this.createdTime = Date.now();
        }

        hasFlag(flag: string): boolean {
            return this.flags.indexOf(flag) >= 0;
        }

        addFlag(flag: string): void {
            if (!this.hasFlag(flag)) this.flags.push(flag);
        }

        hasItem(id: string, count?: number): boolean {
            const n = this.items[id] || 0;
            return count === undefined ? n > 0 : n >= count;
        }

        addItem(id: string, count: number): void {
            this.items[id] = (this.items[id] || 0) + count;
        }

        removeItem(id: string, count: number): void {
            const cur = this.items[id] || 0;
            const next = cur - count;
            if (next <= 0) delete this.items[id];
            else this.items[id] = next;
        }

        toSave(): any {
            return {
                name: this.name, level: this.level, exp: this.exp,
                freePoints: this.freePoints, hp: this.hp, mp: this.mp,
                money: this.money, attrs: { ...this.attrs },
                skills: this.skills.slice(), items: { ...this.items },
                flags: this.flags.slice(), currentNode: this.currentNode,
                createdTime: this.createdTime
            };
        }

        static fromSave(data: any): Hero {
            const h = new Hero();
            if (!data) return h;
            h.name = data.name || h.name;
            h.level = data.level || 1;
            h.exp = data.exp || 0;
            h.freePoints = data.freePoints || 0;
            h.hp = data.hp ?? h.hp;
            h.mp = data.mp ?? h.mp;
            h.money = data.money ?? 50;
            h.attrs = Object.assign({ strength: 5, body: 5, agility: 5, spirit: 5 }, data.attrs || {});
            h.skills = data.skills || [];
            h.items = data.items || {};
            h.flags = data.flags || [];
            h.currentNode = data.currentNode || "story_start";
            h.createdTime = data.createdTime || 0;
            return h;
        }
    }
