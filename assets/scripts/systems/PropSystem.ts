// ============================================================
// assets/scripts/systems/PropSystem.ts   【完整新版·次数跨关持久化】
// 道具系统（纯逻辑类）
// 
// 本版改动：道具数量从存档读写，跨关不重置
//   - 首次游玩：每种道具 3 个
//   - 使用后保存到存档，下一关继续沿用剩余数量
//   - 看广告奖励（后续抖音适配）通过 add() 增加并保存
// ============================================================

import { GameConfig } from '../data/GameConfig';
import { SaveSystem } from './SaveSystem';
import { Logger } from '../utils/Logger';

export class PropSystem {

    /** 道具数量表：道具ID → 持有数量 */
    private _counts: Map<string, number> = new Map();

    /**
     * 初始化：从存档读取各道具数量
     * 首次游玩（存档无记录）时使用初始值 3
     */
    public init(): void {
        this._counts.clear();

        // 读取存档中的道具记录
        const saveData = SaveSystem.load();

        // ?? 运算符：存档里没有记录（undefined）时用初始值 3，
        // 用完为 0 时保持 0（不会错误重置回 3）
        this._counts.set(GameConfig.PROP_HINT, saveData.props[GameConfig.PROP_HINT] ?? GameConfig.INITIAL_PROP_COUNT);
        this._counts.set(GameConfig.PROP_SHUFFLE, saveData.props[GameConfig.PROP_SHUFFLE] ?? GameConfig.INITIAL_PROP_COUNT);
        this._counts.set(GameConfig.PROP_BOMB, saveData.props[GameConfig.PROP_BOMB] ?? GameConfig.INITIAL_PROP_COUNT);
        this._counts.set(GameConfig.PROP_SKILL, saveData.props[GameConfig.PROP_SKILL] ?? GameConfig.INITIAL_PROP_COUNT);

        Logger.log(`PropSystem.init: 道具读取完毕（提示${this._counts.get(GameConfig.PROP_HINT)}、` +
            `重排${this._counts.get(GameConfig.PROP_SHUFFLE)}、炸弹${this._counts.get(GameConfig.PROP_BOMB)}、` +
            `解锁${this._counts.get(GameConfig.PROP_SKILL)}）`);
    }

    /** 获取道具数量 */
    public getCount(propId: string): number {
        return this._counts.get(propId) ?? 0;
    }

    /** 是否还有道具 */
    public hasProp(propId: string): boolean {
        return this.getCount(propId) > 0;
    }

    /**
     * 消耗一个道具（并保存到存档，跨关生效）
     * @returns true=成功，false=数量不足
     */
    public consume(propId: string): boolean {
        const current = this.getCount(propId);
        if (current <= 0) {
            Logger.warn(`PropSystem.consume: 道具 ${propId} 数量不足（当前 ${current}）`);
            return false;
        }

        // 内存扣减
        this._counts.set(propId, current - 1);
        // 存档保存（跨关持久化）
        SaveSystem.setPropCount(propId, current - 1);

        Logger.log(`PropSystem.consume: 消耗道具 ${propId}，剩余 ${current - 1}`);
        return true;
    }

    /**
     * 增加道具（看广告奖励，后续抖音适配调用）
     * @param propId 道具ID
     * @param count 增加数量
     */
    public add(propId: string, count: number): void {
        const current = this.getCount(propId);
        const newCount = current + count;

        // 内存更新
        this._counts.set(propId, newCount);
        // 存档保存
        SaveSystem.setPropCount(propId, newCount);

        Logger.log(`PropSystem.add: 道具 ${propId} +${count}，现有 ${newCount}`);
    }
}