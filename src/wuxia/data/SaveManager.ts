namespace WuXia {
    /** 存档管理：localStorage 持久化 */
    export class SaveManager {
        static readonly SAVE_KEY = "wuxia_save_v1";

        static save(hero: Hero): void {
            try {
                localStorage.setItem(SaveManager.SAVE_KEY, JSON.stringify(hero.toSave()));
            } catch (e) {
                console.error("[存档失败]", e);
            }
        }

        static load(): Hero | null {
            try {
                const raw = localStorage.getItem(SaveManager.SAVE_KEY);
                if (!raw) return null;
                const data = JSON.parse(raw);
                return Hero.fromSave(data);
            } catch (e) {
                console.error("[读档失败]", e);
                return null;
            }
        }

        static clear(): void {
            try {
                localStorage.removeItem(SaveManager.SAVE_KEY);
            } catch (e) {
                console.error("[清档失败]", e);
            }
        }

        static hasSave(): boolean {
            return !!localStorage.getItem(SaveManager.SAVE_KEY);
        }
    }
}
