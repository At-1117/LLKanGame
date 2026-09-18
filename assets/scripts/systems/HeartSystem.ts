// ============================================================
// assets/scripts/systems/HeartSystem.ts
// 血量系统（静态类）
// 规则：游戏失败扣 1 颗心；每 10 分钟自动恢复 1 颗；上限 5 颗
// ============================================================

import { GameConfig } from '../data/GameConfig';
import { SaveSystem } from './SaveSystem';
import { Logger } from '../utils/Logger';

export class HeartSystem {

    /**
     * 获取当前心数（读取时会自动结算离线恢复）
     * 
     * 离线恢复逻辑：
     *   经过时间 / 恢复间隔 = 应恢复的心数
     *   恢复后更新时间戳，写回存档
     */
    public static getHearts(): number {
        const data = SaveSystem.load();

        // 当前时间
        const now = Date.now();
        // 距离上次恢复经过的毫秒数
        const elapsed = now - data.lastHeartTime;
        // 应恢复的心数
        const recovered = Math.floor(elapsed / GameConfig.HEART_RECOVER_INTERVAL);

        if (recovered > 0) {
            // 加上恢复的心数（不超过上限）
            data.hearts = Math.min(GameConfig.MAX_HEARTS, data.hearts + recovered);

            // 更新时间戳：
            // 心满了 → 直接设为现在（重新计时）
            // 没满 → 加上"已消耗掉的恢复时长"
            if (data.hearts >= GameConfig.MAX_HEARTS) {
                data.lastHeartTime = now;
            } else {
                data.lastHeartTime += recovered * GameConfig.HEART_RECOVER_INTERVAL;
            }

            SaveSystem.save(data);
            Logger.log(`HeartSystem.getHearts: 离线恢复了 ${recovered} 颗心，当前 ${data.hearts} 颗`);
        }

        return data.hearts;
    }

    /**
     * 扣 1 颗心（游戏失败时调用）
     * @returns 扣除后的心数
     */
    public static loseHeart(): number {
        // 先结算离线恢复，拿到最新心数
        const current = this.getHearts();
        const data = SaveSystem.load();

        // 扣心（不低于 0）
        data.hearts = Math.max(0, current - 1);

        // 如果是从满血开始扣的，记录开始恢复的时间
        if (current >= GameConfig.MAX_HEARTS) {
            data.lastHeartTime = Date.now();
        }

        SaveSystem.save(data);
        Logger.log(`HeartSystem.loseHeart: 扣 1 心，剩余 ${data.hearts} 颗`);
        return data.hearts;
    }

    /**
     * 距离下一颗心恢复还剩多少秒
     * @returns 秒数；心已满返回 0
     */
    public static getSecondsToNextHeart(): number {
        const data = SaveSystem.load();
        if (data.hearts >= GameConfig.MAX_HEARTS) return 0;

        const now = Date.now();
        const elapsed = now - data.lastHeartTime;
        const remainingMs = GameConfig.HEART_RECOVER_INTERVAL - elapsed;
        return Math.max(0, Math.ceil(remainingMs / 1000));
    }

        /**
     * 【新增】添加 1 颗心（看广告奖励用）
     * 注意：未加满时不影响原有的自动恢复计时
     * @returns 添加后的心数
     */
    public static addHeart(): number {
        // 先结算离线恢复，拿到最新心数
        const current = this.getHearts();
        const data = SaveSystem.load();

        // 已满则不加
        if (current >= GameConfig.MAX_HEARTS) {
            return current;
        }

        // 加 1 颗（不超过上限）
        data.hearts = Math.min(GameConfig.MAX_HEARTS, current + 1);

        // 加满时重置恢复计时
        if (data.hearts >= GameConfig.MAX_HEARTS) {
            data.lastHeartTime = Date.now();
        }

        SaveSystem.save(data);
        Logger.log(`HeartSystem.addHeart: +1 心，当前 ${data.hearts} 颗`);
        return data.hearts;
    }

    /** 是否还有心 */
    public static hasHearts(): boolean {
        return this.getHearts() > 0;
    }
}