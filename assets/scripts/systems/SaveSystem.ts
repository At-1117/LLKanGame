// ============================================================
// assets/scripts/systems/SaveSystem.ts
// 存档系统（静态类）
// 负责：玩家进度的读取与保存
// 
// 存储方案：Cocos 内置 sys.localStorage
//   - 浏览器预览：映射到浏览器 localStorage
//   - 抖音小游戏：自动映射到平台存储接口
//   一套代码全平台通用
// ============================================================

import { sys } from 'cc';
import { PlayerSaveData } from '../data/SaveData';
import { Logger } from '../utils/Logger';

export class SaveSystem {

    /** 存档在 localStorage 中的键名 */
    private static readonly KEY = 'llk_save_data';

    // ==================== 公开方法 ====================

    /**
     * 读取存档
     * @returns 存档数据；没有存档或解析失败时返回默认值
     */
    public static load(): PlayerSaveData {
        try {
            const raw = sys.localStorage.getItem(this.KEY);
            if (!raw) {
                return this.getDefault();
            }
            const data = JSON.parse(raw) as PlayerSaveData;

            // ===== 兼容旧存档：合并默认值 =====
            // 旧存档可能没有 hearts/settings 字段，用默认值补齐
            const def = this.getDefault();
            return {
                ...def,
                ...data,
                settings: { ...def.settings, ...(data.settings || {}) },
            };
        } catch (err) {
            Logger.error('SaveSystem.load: 存档读取失败，使用默认存档', err);
            return this.getDefault();
        }
    }

    /**
     * 保存存档
     * @param data 存档数据
     */
    public static save(data: PlayerSaveData): void {
        try {
            // 序列化并写入本地存储
            sys.localStorage.setItem(this.KEY, JSON.stringify(data));
        } catch (err) {
            Logger.error('SaveSystem.save: 存档写入失败', err);
        }
    }

    /**
     * 更新某关卡的星级（只保留历史最高星）
     * @param levelId 关卡编号
     * @param stars 本次获得的星级（1~3）
     */
    public static updateLevelStars(levelId: number, stars: number): void {
        // 读取当前存档
        const data = this.load();

        // 取历史星级（没有则 0）
        const oldStars = data.stars[levelId] ?? 0;

        // 只有更高星才覆盖
        if (stars > oldStars) {
            data.stars[levelId] = stars;
        }

        // 写回
        this.save(data);

        Logger.log(`SaveSystem.updateLevelStars: 第${levelId}关 ${oldStars}星 → ${Math.max(oldStars, stars)}星`);
    }

    /**
     * 通关后解锁下一关
     * @param clearedLevelId 刚通关的关卡编号
     */
    public static unlockNextLevel(clearedLevelId: number): void {
        // 读取当前存档
        const data = this.load();

        // currentLevel 语义：已解锁的最高关卡编号
        // 只有通关了"当前已解锁的最后一关"才推进
        if (clearedLevelId >= data.currentLevel) {
            data.currentLevel = clearedLevelId + 1;
        }

        // 写回
        this.save(data);

        Logger.log(`SaveSystem.unlockNextLevel: 已解锁到第 ${data.currentLevel} 关`);
    }

    /**
     * 判断某关卡是否已解锁
     * @param levelId 关卡编号
     */
    public static isLevelUnlocked(levelId: number): boolean {
        const data = this.load();
        return levelId <= data.currentLevel;
    }

    // ==================== 私有方法 ====================

    /**
     * 获取默认存档（首次游玩）
     */
    private static getDefault(): PlayerSaveData {
        return {
            currentLevel: 1,        // 从第 1 关开始
            stars: {},
            levelSeeds: {},         // 棋盘种子
            hearts: 5,              // 满血开局
            lastHeartTime: 0,       // 0 = 从未扣过心
            settings: {
                soundOn: true,      // 音效默认开
                musicOn: true,      // 背景音乐默认开
                vibrationOn: true,  // 震动默认开
            },
            props: {},
            totalScore: 0,
        };
    }

        // ==================== 设置读写（第六阶段新增） ====================

    /** 获取设置 */
    public static getSettings(): PlayerSaveData['settings'] {
        return this.load().settings;
    }

    /** 设置音效开关 */
    public static setSoundOn(on: boolean): void {
        const data = this.load();
        data.settings.soundOn = on;
        this.save(data);
    }

    /** 设置背景音乐开关 */
    public static setMusicOn(on: boolean): void {
        const data = this.load();
        data.settings.musicOn = on;
        this.save(data);
    }

    /** 设置震动开关 */
    public static setVibrationOn(on: boolean): void {
        const data = this.load();
        data.settings.vibrationOn = on;
        this.save(data);
    }

    /**
     * 设置某个道具的持有数量（跨关持久化）
     * @param propId 道具ID
     * @param count 数量
     */
    public static setPropCount(propId: string, count: number): void {
        const data = this.load();
        data.props[propId] = count;
        this.save(data);
    }

    /**
     * 【开发者模式】清除全部存档
     */
    public static reset(): void {
        try {
            sys.localStorage.removeItem(this.KEY);
            Logger.log('SaveSystem.reset: 存档已清除');
        } catch (err) {
            Logger.error('SaveSystem.reset: 清除存档失败', err);
        }
    }

    // ==================== 棋盘种子（新增） ====================

    /** 获取某关的棋盘种子（0 = 未生成） */
    public static getLevelSeed(levelId: number): number {
        const data = this.load();
        return data.levelSeeds[levelId] ?? 0;
    }

    /** 保存某关的棋盘种子 */
    public static setLevelSeed(levelId: number, seed: number): void {
        const data = this.load();
        data.levelSeeds[levelId] = seed;
        this.save(data);
    }
}