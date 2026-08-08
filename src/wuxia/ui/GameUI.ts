import { GrowthSystem } from "../system/GrowthSystem";
import type { Hero, IGameUI } from "../model/Hero";

    /** 界面层：标题栏 / 日志区 / 选项按钮 / 输入框 */
    export class GameUI implements IGameUI {
        private static readonly LOG_W = 920;
        private static readonly LOG_H = 420;
        private static readonly MAX_ROWS = 120;
        private static readonly FONT = "Microsoft YaHei";

        private onCommand: (cmd: string) => void;

        private logContent!: Laya.Sprite;
        private logView!: Laya.Sprite;
        private logRows: Laya.Text[] = [];
        private totalH = 0;

        private choiceBox!: Laya.Sprite;
        private choiceButtons: Laya.Sprite[] = [];

        private input!: Laya.Input;
        private sendBtn!: Laya.Sprite;

        // 标题栏状态文本
        private stName!: Laya.Text;
        private stHp!: Laya.Text;
        private stMp!: Laya.Text;
        private stMoney!: Laya.Text;
        private stPoints!: Laya.Text;

        constructor(onCommand: (cmd: string) => void) {
            this.onCommand = onCommand;
            this.build();
        }

        // ───────────────── 构建界面 ─────────────────
        private build(): void {
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

        private makeText(t: string, color: string, size: number, bold = false): Laya.Text {
            const tx = new Laya.Text();
            tx.text = t;
            tx.font = GameUI.FONT;
            tx.fontSize = size;
            tx.color = color;
            tx.bold = bold;
            return tx;
        }

        private makeButton(text: string, w: number, h: number, handler: () => void): Laya.Sprite {
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
        log(text: string, color?: string): void {
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
                const old = this.logRows.shift()!;
                this.totalH -= old.textHeight + 6;
                this.logContent.removeChild(old);
            }
            this.scrollToBottom();
        }

        private scrollToBottom(): void {
            if (this.totalH > GameUI.LOG_H) {
                this.logContent.y = GameUI.LOG_H - this.totalH;
            } else {
                this.logContent.y = 0;
            }
        }

        // ───────────────── 选项按钮 ─────────────────
        showChoices(choices: { text: string; handler: () => void }[]): void {
            this.clearChoices();
            if (choices.length === 0) return;
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

        clearChoices(): void {
            for (const b of this.choiceButtons) {
                this.choiceBox.removeChild(b);
            }
            this.choiceButtons.length = 0;
        }

        // ───────────────── 状态栏 ─────────────────
        refreshStatus(hero: Hero): void {
            const maxHp = GrowthSystem.maxHp(hero);
            const maxMp = GrowthSystem.maxMp(hero);
            this.stName.text = `${hero.name}  Lv.${hero.level}`;
            this.stHp.text = `气血 ${hero.hp}/${maxHp}`;
            this.stMp.text = `内力 ${hero.mp}/${maxMp}`;
            this.stMoney.text = `银两 ${hero.money}`;
            this.stPoints.text = hero.freePoints > 0 ? `属性点 ${hero.freePoints}` : "";
        }

        setInputHint(hint: string): void {
            this.input.prompt = hint;
        }

        // ───────────────── 输入处理 ─────────────────
        private onInputKey(ev: any): void {
            if (ev.keyCode === 13) {
                this.doSend();
            }
        }

        private doSend(): void {
            const cmd = this.input.text.trim();
            if (!cmd) return;
            this.input.text = "";
            this.onCommand(cmd);
        }

        destroy(): void {
            this.logView.mask = null;
        }
    }
