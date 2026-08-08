namespace WuXia {
    /** 游戏总控制器：串联 UI / 主角 / 剧情 / 战斗 / 养成 */
    export class Game {
        private hero!: Hero;
        private ui!: GameUI;
        private battle!: BattleSystem;
        private story!: StorySystem;

        constructor() {
            this.setup();
        }

        private setup(): void {
            // 读档或新游戏
            const saved = SaveManager.load();
            this.hero = saved || new Hero();

            this.ui = new GameUI((cmd) => this.handleCommand(cmd));
            this.battle = new BattleSystem(this.hero, this.ui);
            this.story = new StorySystem(this.hero, this.ui, this.battle);

            this.ui.refreshStatus(this.hero);
            if (saved) {
                this.ui.log("已读取存档。", "#a0a0a0");
            } else {
                this.ui.log("这是一段属于你的江湖故事。", "#a0a0a0");
            }
            // 从存档节点继续，或从头开始
            this.story.enter(this.hero.currentNode);
        }

        // ───────────────── 命令分发 ─────────────────
        private handleCommand(cmd: string): void {
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
                case "帮助": this.cmdHelp(); break;
                case "status":
                case "属性":
                case "查看": this.cmdStatus(); break;
                case "rest":
                case "休息": this.cmdRest(); break;
                case "meditate":
                case "打坐": this.cmdMeditate(); break;
                case "add":
                case "加": this.cmdAddPoint(words[1]); break;
                case "use":
                case "使用": this.cmdUse(words.slice(1).join(" ")); break;
                case "save":
                case "存档": this.cmdSave(); break;
                case "load":
                case "读档": this.cmdLoad(); break;
                case "new":
                case "重新开始": this.cmdNewGame(); break;
                case "battle":
                case "切磋": this.cmdTestBattle(words[1]); break;
                default:
                    this.ui.log(`未知指令「${cmd}」。输入 help 查看帮助。`, "#888888");
            }
        }

        // ───────────────── 指令实现 ─────────────────
        private cmdHelp(): void {
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
            for (const line of h) this.ui.log(line, "#a8d8ff");
        }

        private cmdStatus(): void {
            const h = this.hero;
            const bonus = GrowthSystem.innerBonus(h);
            const bonusText = (k: keyof HeroAttributes) =>
                bonus[k] > 0 ? ` (+${bonus[k]}内功)` : "";
            const attrNames: { [k in keyof HeroAttributes]: string } = {
                strength: "膂力", body: "体魄", agility: "身法", spirit: "内息"
            };
            const lines: [string, string][] = [
                [`${h.name}　Lv.${h.level}`, "#e8c86a"],
                [`经验 ${h.exp} / ${GrowthSystem.expNeed(h.level)}`, "#a0a0a0"],
                [`气血 ${h.hp}/${GrowthSystem.maxHp(h)}　内力 ${h.mp}/${GrowthSystem.maxMp(h)}`, "#a0a0a0"],
                ["", ""]
            ];
            for (const k of ["strength", "body", "agility", "spirit"] as (keyof HeroAttributes)[]) {
                lines.push([`${attrNames[k]} ${h.attrs[k]}${bonusText(k)}`, "#d8c8a0"]);
            }
            lines.push(["", ""]);
            lines.push([`攻击 ${GrowthSystem.attack(h)}　防御 ${GrowthSystem.defense(h)}`, "#d8c8a0"]);
            lines.push([
                `命中 ${Math.round(GrowthSystem.hitRate(h) * 100)}%　暴击 ${Math.round(GrowthSystem.critRate(h) * 100)}%　闪避 ${Math.round(GrowthSystem.dodgeRate(h) * 100)}%`,
                "#d8c8a0"
            ]);
            lines.push([`银两 ${h.money}　自由属性点 ${h.freePoints}`, "#ffd966"]);

            if (h.skills.length > 0) {
                lines.push(["", ""]);
                const names = h.skills.map(id => GameData.getSkill(id)?.name || id).join("、");
                lines.push([`武功：${names}`, "#ffcc44"]);
            }
            if (Object.keys(h.items).length > 0) {
                lines.push(["", ""]);
                const itemNames = Object.keys(h.items)
                    .map(id => `${GameData.getItem(id)?.name || id} x${h.items[id]}`)
                    .join("、");
                lines.push([`物品：${itemNames}`, "#66ff99"]);
            }
            for (const [t, c] of lines) this.ui.log(t || "　", t ? c : "#2a2a2a");
        }

        private cmdRest(): void {
            const h = this.hero;
            h.hp = GrowthSystem.maxHp(h);
            h.mp = GrowthSystem.maxMp(h);
            this.ui.log("你寻了处干净地方歇息，气血与内力尽复。", "#7ec8ff");
            this.ui.refreshStatus(h);
        }

        private cmdMeditate(): void {
            const tip = GrowthSystem.meditate(this.hero);
            this.ui.log(tip, "#7ec8ff");
            this.ui.refreshStatus(this.hero);
        }

        private cmdAddPoint(arg?: string): void {
            if (!arg) {
                this.ui.log(`用法：add 膂力|体魄|身法|内息（当前自由属性点 ${this.hero.freePoints}）`, "#888888");
                return;
            }
            if (this.hero.freePoints <= 0) {
                this.ui.log("没有可分配的自由属性点，去历练升级吧。", "#ff8888");
                return;
            }
            const map: { [k: string]: keyof HeroAttributes } = {
                "膂力": "strength", "体魄": "body", "身法": "agility", "内息": "spirit",
                "strength": "strength", "body": "body", "agility": "agility", "spirit": "spirit"
            };
            const key = map[arg];
            if (!key) {
                this.ui.log("属性名有误，可选：膂力 / 体魄 / 身法 / 内息", "#888888");
                return;
            }
            if (GrowthSystem.addPoint(this.hero, key)) {
                const names: { [k in keyof HeroAttributes]: string } = {
                    strength: "膂力", body: "体魄", agility: "身法", spirit: "内息"
                };
                this.ui.log(`${names[key]} +1（剩余属性点 ${this.hero.freePoints}）。`, "#ffcc44");
                this.ui.refreshStatus(this.hero);
            }
        }

        private cmdUse(itemName: string): void {
            if (!itemName) {
                this.ui.log("用法：use 物品名称", "#888888");
                return;
            }
            // 按名称匹配
            let targetId: string | null = null;
            for (const id of Object.keys(this.hero.items)) {
                const it = GameData.getItem(id);
                if (it && (it.name === itemName || it.id === itemName)) {
                    targetId = id;
                    break;
                }
            }
            if (!targetId) {
                this.ui.log(`你没有名为「${itemName}」的物品。`, "#ff8888");
                return;
            }
            const result = GrowthSystem.useItem(this.hero, targetId);
            if (result) {
                this.ui.log(result, "#66ff99");
                this.ui.refreshStatus(this.hero);
            } else {
                this.ui.log("该物品无法使用。", "#888888");
            }
        }

        private cmdSave(): void {
            SaveManager.save(this.hero);
            this.ui.log("已存档。", "#a0a0a0");
        }

        private cmdLoad(): void {
            const h = SaveManager.load();
            if (!h) {
                this.ui.log("没有找到存档。", "#ff8888");
                return;
            }
            this.hero = h;
            this.battle = new BattleSystem(this.hero, this.ui);
            this.story = new StorySystem(this.hero, this.ui, this.battle);
            this.ui.refreshStatus(this.hero);
            this.ui.log("读档成功，继续你的江湖之旅。", "#66ff99");
            this.story.enter(h.currentNode);
        }

        private cmdNewGame(): void {
            SaveManager.clear();
            this.hero = new Hero();
            this.battle = new BattleSystem(this.hero, this.ui);
            this.story = new StorySystem(this.hero, this.ui, this.battle);
            this.ui.refreshStatus(this.hero);
            this.ui.log("新的江湖之旅开始了。", "#66ff99");
            this.story.enter("story_start");
        }

        /** 调试用：输入 battle 野狼 可自由切磋 */
        private cmdTestBattle(enemyId?: string): void {
            const id = enemyId && GameData.getEnemy(enemyId) ? enemyId : "wolf";
            this.battle.start(id, (win) => {
                if (win) {
                    this.ui.log("切磋结束。", "#a0a0a0");
                } else {
                    this.hero.hp = Math.max(1, Math.round(GrowthSystem.maxHp(this.hero) * 0.5));
                    this.ui.log("切磋失败……你强撑着爬起来。", "#ff8888");
                }
                this.ui.refreshStatus(this.hero);
            }, 1 + (this.hero.level - 1) * 0.15);
        }
    }
}
