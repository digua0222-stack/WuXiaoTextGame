import { GameData } from "../data/GameData";
import type { Hero, HeroAttributes } from "../model/Hero";

    /** 属性养成框架：升级 / 加点 / 派生属性 / 修炼 */
    export class GrowthSystem {
        /** 升级所需经验 = 等级 * 等级 * 80 + 60 */
        static expNeed(level: number): number {
            return level * level * 80 + 60;
        }

        /** 增加经验，自动处理连续升级；返回提示行 */
        static gainExp(hero: Hero, amount: number): string[] {
            const tips: string[] = [];
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
        static addPoint(hero: Hero, key: keyof HeroAttributes): boolean {
            if (hero.freePoints <= 0) return false;
            hero.attrs[key]++;
            hero.freePoints--;
            return true;
        }

        /** 学习武功 */
        static learnSkill(hero: Hero, skillId: string): boolean {
            const s = GameData.getSkill(skillId);
            if (!s || hero.skills.indexOf(skillId) >= 0) return false;
            hero.skills.push(skillId);
            return true;
        }

        static hasSkill(hero: Hero, skillId: string): boolean {
            return hero.skills.indexOf(skillId) >= 0;
        }

        /** 已修习内功叠加的四维加成 */
        static innerBonus(hero: Hero): HeroAttributes {
            const b: HeroAttributes = { strength: 0, body: 0, agility: 0, spirit: 0 };
            for (const id of hero.skills) {
                const s = GameData.getSkill(id);
                if (s && s.type === "inner" && s.attrBonus) {
                    b.strength += s.attrBonus.strength || 0;
                    b.body += s.attrBonus.body || 0;
                    b.agility += s.attrBonus.agility || 0;
                    b.spirit += s.attrBonus.spirit || 0;
                }
            }
            return b;
        }

        static maxHp(hero: Hero): number {
            return 100 + (hero.attrs.body + GrowthSystem.innerBonus(hero).body) * 20;
        }
        static maxMp(hero: Hero): number {
            return 50 + (hero.attrs.spirit + GrowthSystem.innerBonus(hero).spirit) * 12;
        }
        static attack(hero: Hero): number {
            return 8 + (hero.attrs.strength + GrowthSystem.innerBonus(hero).strength) * 3;
        }
        static defense(hero: Hero): number {
            return 4 + (hero.attrs.body + GrowthSystem.innerBonus(hero).body) * 2;
        }
        static hitRate(hero: Hero): number {
            const a = hero.attrs.agility + GrowthSystem.innerBonus(hero).agility;
            return Math.min(0.97, 0.82 + a * 0.012);
        }
        static critRate(hero: Hero): number {
            const a = hero.attrs.agility + GrowthSystem.innerBonus(hero).agility;
            return Math.min(0.4, 0.03 + a * 0.008);
        }
        /** 闪避率：相对对手命中率计算 */
        static dodgeRate(hero: Hero): number {
            const a = hero.attrs.agility + GrowthSystem.innerBonus(hero).agility;
            return Math.min(0.4, a * 0.02);
        }

        /** 使用消耗品（可食用物品） */
        static useItem(hero: Hero, itemId: string): string | null {
            const it = GameData.getItem(itemId);
            if (!it) return null;
            if (!hero.hasItem(itemId)) return "你没有这件物品。";
            if (!it.healHp && !it.healMp) return `${it.name} 似乎不能直接食用。`;
            hero.removeItem(itemId, 1);
            if (it.healHp) hero.hp = Math.min(hero.hp + it.healHp, GrowthSystem.maxHp(hero));
            if (it.healMp) hero.mp = Math.min(hero.mp + it.healMp, GrowthSystem.maxMp(hero));
            return `服用了【${it.name}】，${it.healHp ? "气血 +" + it.healHp + "，" : ""}${it.healMp ? "内力 +" + it.healMp : ""}`.replace(/，$/g, "");
        }

        /** 打坐恢复（按内息） */
        static meditate(hero: Hero): string {
            const gain = 20 + hero.attrs.spirit * 3;
            hero.hp = Math.min(hero.hp + gain, GrowthSystem.maxHp(hero));
            hero.mp = Math.min(hero.mp + gain * 0.8, GrowthSystem.maxMp(hero));
            return `你盘膝打坐，调息片刻。气血 +${Math.round(gain)}，内力 +${Math.round(gain * 0.8)}。`;
        }
    }
