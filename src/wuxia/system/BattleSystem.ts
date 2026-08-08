import { GameData } from "../data/GameData";
import { GrowthSystem } from "./GrowthSystem";
import type { EnemyData, Hero, IGameUI, SkillData } from "../model/Hero";

    /** 战斗中的敌人实例 */
    class BattleEnemy {
        data: EnemyData;
        hp: number;
        mp: number;
        constructor(data: EnemyData, levelScale: number) {
            this.data = data;
            this.hp = Math.round(data.hp * levelScale);
            this.mp = data.mp;
        }
    }

    /** 回合制战斗框架 */
    export class BattleSystem {
        private hero: Hero;
        private ui: IGameUI;
        private enemy: BattleEnemy | null = null;
        private enemyScale: number = 1;
        private onEnd: ((win: boolean, drops: string[]) => void) | null = null;
        private guarding = false;

        constructor(hero: Hero, ui: IGameUI) {
            this.hero = hero;
            this.ui = ui;
        }

        get running(): boolean {
            return this.enemy !== null;
        }

        /** 开始战斗，levelScale 用于按玩家等级微调敌人强度 */
        start(enemyId: string, onEnd: (win: boolean, drops: string[]) => void, levelScale?: number): void {
            const data = GameData.getEnemy(enemyId);
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
        private showActions(): void {
            if (!this.enemy) return;
            const enemy = this.enemy;
            const actions: { text: string; handler: () => void }[] = [];
            actions.push({ text: "⚔ 攻击", handler: () => this.playerAttack(undefined) });
            actions.push({ text: "🛡 防御", handler: () => this.playerGuard() });
            // 可用的外功
            for (const id of this.hero.skills) {
                const s = GameData.getSkill(id);
                if (!s || s.type !== "attack") continue;
                const mpCost = s.mpCost;
                const text = `${s.name}（内力 ${mpCost}）`;
                if (this.hero.mp < mpCost) {
                    actions.push({ text: `✖ ${s.name}(内力不足)`, handler: () => this.ui.log("内力不足，无法施展。", "#ff8888") });
                } else {
                    actions.push({ text: `★ ${s.name}（威力 ${s.power}）`, handler: () => this.playerAttack(id) });
                }
            }
            actions.push({ text: "🏃 逃跑", handler: () => this.playerFlee() });
            this.ui.showChoices(actions);
        }

        /** 玩家普通攻击或施展武功 */
        private playerAttack(skillId: string | undefined): void {
            if (!this.enemy) return;
            const e = this.enemy;
            let power = 0, mpCost = 0, skillName = "普通攻击";
            if (skillId) {
                const s = GameData.getSkill(skillId);
                if (!s) return;
                if (this.hero.mp < s.mpCost) {
                    this.ui.log("内力不足，无法施展。", "#ff8888");
                    this.showActions();
                    return;
                }
                this.hero.mp -= s.mpCost;
                power = s.power;
                skillName = s.name;
                this.ui.log(`你施展【${s.name}】！`, "#7ec8ff");
            } else {
                this.ui.log("你欺身而上，挥拳攻向对方。", "#d8c8a0");
            }

            const hit = Math.random() < GrowthSystem.hitRate(this.hero) - this.dodgeRateOf(e);
            if (!hit) {
                this.ui.log(`${e.data.name} 侧身避开了你的攻击！`, "#a0a0a0");
            } else {
                const crit = Math.random() < GrowthSystem.critRate(this.hero);
                let dmg = (GrowthSystem.attack(this.hero) + power) - e.data.defense * 0.6;
                dmg = Math.max(1, dmg * (0.9 + Math.random() * 0.2));
                if (crit) dmg *= 1.8;
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

        private playerGuard(): void {
            this.ui.log("你凝神戒备，气沉丹田，准备抵挡对方的攻势。", "#7ec8ff");
            this.guarding = true;
            this.enemyTurn();
        }

        private playerFlee(): void {
            if (!this.enemy) return;
            const chance = 0.5 + (this.hero.attrs.agility - this.enemy.data.agility) * 0.04;
            if (Math.random() < Math.max(0.3, Math.min(0.95, chance))) {
                this.ui.log("你且战且退，觅得空隙，转身逃出了战圈。", "#a0a0a0");
                this.endBattle(false, true);
            } else {
                this.ui.log("对方紧咬不放，你没能脱身！", "#ff8888");
                this.enemyTurn();
            }
        }

        /** 敌人回合 */
        private enemyTurn(): void {
            if (!this.enemy) return;
            const e = this.enemy;
            const heroDef = GrowthSystem.defense(this.hero);

            // 敌人技能（如果有 mp 且概率触发）
            let atk = e.data.attack;
            let skillName = "";
            const usable = (e.data.skills || []).filter(id => {
                const s = GameData.getSkill(id);
                return s && s.type === "attack" && e.mp >= s.mpCost;
            });
            if (usable.length > 0 && Math.random() < 0.4) {
                const s = GameData.getSkill(usable[0])!;
                e.mp -= s.mpCost;
                atk += s.power;
                skillName = s.name;
                this.ui.log(`${e.data.name} 施展【${s.name}】！`, "#ff9c6a");
            }

            const guardBonus = this.guarding ? 6 : 0;
            this.guarding = false;
            const hit = Math.random() < e.data.hitRate + e.data.agility * 0.008 - GrowthSystem.dodgeRate(this.hero);
            if (!hit) {
                this.ui.log(`${e.data.name} 的攻击落空了！`, "#a0a0a0");
            } else {
                const crit = Math.random() < e.data.critRate;
                let dmg = (atk + (skillName ? 0 : 0)) - (heroDef + guardBonus) * 0.6;
                dmg = Math.max(1, dmg * (0.9 + Math.random() * 0.2));
                if (crit) dmg *= 1.8;
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

        private dodgeRateOf(e: BattleEnemy): number {
            return Math.min(0.4, e.data.agility * 0.02);
        }

        /** 结算战斗：win=true 玩家胜利 */
        private endBattle(win: boolean, fled = false): void {
            if (!this.enemy) return;
            const e = this.enemy;
            const drops: string[] = [];
            if (win) {
                const gainExp = Math.round(e.data.exp * this.enemyScale);
                const tips = GrowthSystem.gainExp(this.hero, gainExp);
                this.hero.money += e.data.money;
                this.ui.log(`战斗胜利！获得 ${gainExp} 经验、${e.data.money} 银两。`, "#66ff99");
                for (const t of tips) this.ui.log(t, "#66ff99");
                // 掉落
                if (e.data.drops) {
                    for (const d of e.data.drops) {
                        if (Math.random() < d.chance) {
                            const n = d.count || 1;
                            this.hero.addItem(d.item, n);
                            const it = GameData.getItem(d.item);
                            drops.push(d.item);
                            this.ui.log(`从${e.data.name}身上获得了【${it ? it.name : d.item}】x${n}`, "#66ff99");
                        }
                    }
                }
            } else if (fled) {
                this.ui.log("战斗结束。", "#a0a0a0");
            }
            this.ui.log("─── 战斗结束 ───", "#e8c86a");
            const cb = this.onEnd;
            const enemyData = this.enemy.data;
            this.enemy = null;
            this.onEnd = null;
            this.ui.refreshStatus(this.hero);
            this.ui.clearChoices();
            if (cb) cb(win, drops);
        }

        /** 战斗中玩家输入指令，返回是否被消费 */
        handleInput(cmd: string): boolean {
            if (!this.enemy) return false;
            const c = cmd.trim().toLowerCase();
            const words = c.split(/\s+/);
            const first = words[0];
            if (first === "attack" || first === "攻击" || first === "a") {
                this.playerAttack(undefined);
            } else if (first === "guard" || first === "防御" || first === "d") {
                this.playerGuard();
            } else if (first === "flee" || first === "逃跑" || first === "run") {
                this.playerFlee();
            } else if (first === "skill" || first === "武功") {
                // 通过按钮选择即可
                this.ui.log("请点击下方按钮选择施展的武功。", "#a0a0a0");
            } else if (/^\d+$/.test(c)) {
                // 数字：对应武功序号
                const attacks = this.hero.skills
                    .map(id => GameData.getSkill(id))
                    .filter((s): s is SkillData => !!s && s.type === "attack");
                const idx = parseInt(c, 10) - 1;
                if (idx >= 0 && idx < attacks.length) {
                    this.playerAttack(attacks[idx].id);
                } else {
                    this.ui.log("无效的武功序号。", "#ff8888");
                }
            } else {
                this.ui.log(`战斗中可输入：攻击 / 防御 / 逃跑，或点击按钮行动。`, "#a0a0a0");
            }
            return true;
        }
    }
