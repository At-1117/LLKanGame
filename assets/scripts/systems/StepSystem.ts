// ============================================================
// assets/scripts/systems/StepSystem.ts
// 步数系统（替代废弃的计分系统）
// 规则：每成功消除一对图案消耗 1 步；
//       初始剩余步数 = 最少步数（图案总对数） + 难度奖励 x
// ============================================================

import { Logger } from '../utils/Logger';

export class StepSystem {

    /** 最少需要的步数（图案总对数） */
    private _minSteps: number = 0;

    /** 初始剩余步数（最少步数 + 奖励） */
    private _totalSteps: number = 0;

    /** 当前剩余步数 */
    private _remaining: number = 0;

    /**
     * 初始化（每关开始时调用）
     * @param minSteps 最少需要的步数
     * @param bonus 难度奖励步数（x）
     */
    public init(minSteps: number, bonus: number): void {
        this._minSteps = minSteps;
        this._totalSteps = minSteps + bonus;
        this._remaining = this._totalSteps;
        Logger.log(`StepSystem.init: 最少 ${minSteps} 步，奖励 ${bonus} 步，初始剩余 ${this._remaining} 步`);
    }

    /**
     * 消耗 1 步（每次消除一对图案时调用）
     */
    public consumeStep(): void {
        if (this._remaining > 0) {
            this._remaining--;
        }
    }

    /** 当前剩余步数 */
    public getRemaining(): number {
        return this._remaining;
    }

    /** 初始剩余步数（总步数） */
    public getTotal(): number {
        return this._totalSteps;
    }

    /** 难度奖励步数 x */
    public getBonus(): number {
        return this._totalSteps - this._minSteps;
    }

    /** 步数是否用完 */
    public isOutOfSteps(): boolean {
        return this._remaining <= 0;
    }

    /**
     * 按剩余步数计算星级
     * 规则：剩余 >= x → 3星；剩余 >= x/2 → 2星；通关 → 1星
     */
    public calcStars(): number {
        const bonus = this.getBonus();
        if (this._remaining >= bonus) return 3;
        if (this._remaining >= Math.ceil(bonus / 2)) return 2;
        return 1;
    }
}