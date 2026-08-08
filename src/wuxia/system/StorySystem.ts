namespace WuXia {
    /** 节点式剧情框架：条件判定 / 效果应用 / 战斗挂起 */
    export class StorySystem {
        private hero: Hero;
        private ui: IGameUI;
        private battle: BattleSystem;
        private pendingNode: string | null = null;

        constructor(hero: Hero, ui: IGameUI, battle: BattleSystem) {
            this.hero = hero;
            this.ui = ui;
            this.battle = battle;
        }

        /** 进入剧情节点 */
        enter(nodeId: string): void {
            const node = GameData.getStory(nodeId);
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
        }

        /** 显示节点选项（过滤不满足条件的） */
        private showChoices(node: StoryNode): void {
            const choices: { text: string; handler: () => void }[] = [];
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
                        if (this.pendingNode) return;
                        this.enter(ch.next);
                    }
                });
            }
            if (choices.length > 0) {
                this.ui.showChoices(choices);
            } else if (node.next) {
                this.enter(node.next);
            } else {
                this.ui.clearChoices();
                this.ui.setInputHint("剧情已到尽头。输入 help 查看可用指令。");
            }
        }

        /** 应用剧情效果；若触发战斗则挂起 */
        private applyEffects(effects: StoryEffect[]): void {
            for (const ef of effects) {
                switch (ef.type) {
                    case "exp": {
                        const tips = GrowthSystem.gainExp(this.hero, ef.value);
                        this.ui.log(`获得 ${ef.value} 点经验。`, "#66ff99");
                        for (const t of tips.slice(1)) this.ui.log(t, "#66ff99");
                        break;
                    }
                    case "money":
                        if (ef.value >= 0) {
                            this.hero.money += ef.value;
                            this.ui.log(`获得 ${ef.value} 银两。`, "#ffd966");
                        } else {
                            this.hero.money = Math.max(0, this.hero.money + ef.value);
                            this.ui.log(`失去 ${-ef.value} 银两。`, "#ff8888");
                        }
                        break;
                    case "item": {
                        const it = GameData.getItem(ef.item);
                        const n = ef.count || 1;
                        this.hero.addItem(ef.item, n);
                        this.ui.log(`获得【${it ? it.name : ef.item}】x${n}`, "#66ff99");
                        break;
                    }
                    case "heal":
                        this.hero.hp = Math.min(GrowthSystem.maxHp(this.hero), this.hero.hp + ef.value);
                        this.ui.log(`气血恢复了 ${ef.value} 点。`, "#7ec8ff");
                        break;
                    case "mp":
                        this.hero.mp = Math.min(GrowthSystem.maxMp(this.hero), this.hero.mp + ef.value);
                        this.ui.log(`内力恢复了 ${ef.value} 点。`, "#7ec8ff");
                        break;
                    case "flag":
                        this.hero.addFlag(ef.value);
                        break;
                    case "skill": {
                        const s = GameData.getSkill(ef.value);
                        if (s && GrowthSystem.learnSkill(this.hero, ef.value)) {
                            this.ui.log(`你学会了武功【${s.name}】！${s.type === "inner" ? "（内功被动生效）" : ""}`, "#ffcc44");
                        }
                        break;
                    }
                    case "attribute": {
                        this.hero.attrs[ef.key] += ef.value;
                        const names: { [k in keyof HeroAttributes]: string } = {
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
        private checkConditions(conds?: StoryCondition[]): { ok: boolean; reason: string } {
            if (!conds || conds.length === 0) return { ok: true, reason: "" };
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
                        const it = GameData.getItem(c.item);
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
                        const s = GameData.getSkill(c.value);
                        if (!GrowthSystem.hasSkill(this.hero, c.value))
                            return { ok: false, reason: `需要学会${s ? s.name : c.value}` };
                        break;
                    }
                }
            }
            return { ok: true, reason: "" };
        }
    }
}
