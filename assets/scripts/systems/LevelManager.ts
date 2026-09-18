// ============================================================
// assets/scripts/systems/LevelManager.ts   【完整新版·无限关卡】
// 关卡管理器（静态类）
// 
// 本版改动：
//   1. 前 10 关从 levels.json 加载，难度按规则强制覆盖：
//      1-2 easy、3-5 normal、6-10 hard（不用改 JSON）
//   2. 第 11 关起动态生成无限关卡，难度随机
//   3. 动态生成的关卡带缓存（同一关重玩/重试布局一致）
// ============================================================

import { resources, JsonAsset } from 'cc';
import { LevelConfig } from '../data/LevelData';
import { Logger } from '../utils/Logger';

export class LevelManager {

    // ==================== 私有属性 ====================

    /** 已加载的关卡配置数组（前 10 关） */
    private static _levels: LevelConfig[] | null = null;

    /** 动态生成关卡的缓存：levelId → 配置（保证同一关会话内一致） */
    private static _generatedCache: Map<number, LevelConfig> = new Map();

    /** 【修复】前 10 关覆盖后配置的缓存（保证同一关重玩/重进布局一致） */
    private static _levelConfigCache: Map<number, LevelConfig> = new Map();

    // ==================== 公开方法 ====================

    /**
     * 加载前 10 关的配置（resources/levels/levels.json）
     */
    public static loadLevels(): Promise<LevelConfig[]> {
        if (this._levels) {
            return Promise.resolve(this._levels);
        }

        return new Promise<LevelConfig[]>((resolve, reject) => {
            resources.load('levels/levels', JsonAsset, (err, asset) => {
                if (err) {
                    Logger.error('LevelManager.loadLevels: 关卡配置加载失败', err);
                    reject(err);
                    return;
                }

                try {
                    const raw = asset.json;
                    const data = (typeof raw === 'string') ? JSON.parse(raw) : raw;
                    this._levels = data.levels as LevelConfig[];
                    Logger.log(`LevelManager.loadLevels: 成功加载 ${this._levels.length} 个基础关卡`);
                    resolve(this._levels);
                } catch (parseErr) {
                    Logger.error('LevelManager.loadLevels: JSON 解析失败', parseErr);
                    reject(parseErr);
                }
            });
        });
    }

    /**
     * 按关卡ID获取配置【支持无限关卡】
     * 
     * 规则：
     *   - levelId 1~10：从 JSON 取配置，难度按规则强制覆盖
     *   - levelId > 10：动态生成（带缓存）
     * 
     * @param levelId 关卡编号（任意正整数）
     * @returns 关卡配置；找不到返回 null
     */
    public static getLevel(levelId: number): LevelConfig | null {
        // ===== 前 10 关：从 JSON 找 =====
        const jsonLevel = this._levels?.find((level) => level.levelId === levelId) ?? null;
        if (jsonLevel) {
            // 【修复】缓存覆盖后的配置：同一关重玩/重进返回同一份（布局一致）
            const cached = this._levelConfigCache.get(levelId);
            if (cached) {
                return cached;
            }

            // 克隆基础配置（避免污染 _levels 原始数组）
            const config: LevelConfig = {
                ...jsonLevel,
                initialUnlocked: jsonLevel.initialUnlocked ? [...jsonLevel.initialUnlocked] : [],
            };
            // 按规则强制覆盖难度（JSON 里的旧难度值失效）
            config.difficulty = this.getDifficultyByLevel(levelId);
            // 【需求】棋盘尺寸/图案种数按难度固定（JSON 旧值失效），
            // 且初始解锁对按新尺寸重新生成（旧坐标可能越界）
            const p = this.getBoardParams(config.difficulty);
            config.rows = p.rows;
            config.cols = p.cols;
            config.iconTypes = p.iconTypes;
            config.initialUnlocked = this.generateInitialPairs(p.rows, p.cols, p.pairCount);

            this._levelConfigCache.set(levelId, config);
            return config;
        }

        // ===== 第 11 关起：动态生成 =====
        if (levelId > 10) {
            // 查缓存（同一关重玩/重试用同一份配置）
            const cached = this._generatedCache.get(levelId);
            if (cached) {
                return cached;
            }
            // 生成并缓存
            const generated = this.generateLevel(levelId);
            this._generatedCache.set(levelId, generated);
            return generated;
        }

        return null;
    }

    /**
     * 是否最后一关
     * 【无限关卡：永远返回 false，永远有下一关】
     */
    public static isLastLevel(levelId: number): boolean {
        return false;
    }

    // ==================== 私有方法 ====================

    /**
     * 按关卡编号确定难度
     * 规则：1-2 easy、3-5 normal、6 关起全部 hard
     */
    private static getDifficultyByLevel(levelId: number): 'easy' | 'normal' | 'hard' {
        // 1-2 关：简单
        if (levelId <= 2) return 'easy';
        // 3-5 关：普通
        if (levelId <= 5) return 'normal';
        // 【需求】6 关起全是困难
        return 'hard';
    }

    /**
     * 【需求】按难度固定棋盘参数
     * - easy：6×6，5 种图案，3 对初始解锁
     * - normal：8×7，10 种图案，4 对初始解锁
     * - hard：10×10，18 种图案（全部图案都用上），5 对初始解锁
     */
    private static getBoardParams(difficulty: 'easy' | 'normal' | 'hard'): { rows: number; cols: number; iconTypes: number; pairCount: number } {
        if (difficulty === 'easy') return { rows: 6, cols: 6, iconTypes: 5, pairCount: 3 };
        if (difficulty === 'hard') return { rows: 10, cols: 10, iconTypes: 18, pairCount: 5 };
        return { rows: 8, cols: 7, iconTypes: 10, pairCount: 4 };
    }

    /**
     * 动态生成第 11 关之后的关卡
     * 
     * 参数随关卡递增（有封顶）：
     *   - 棋盘：11-12 关 8×10，13 关起 10×10（最大）
     *   - 图案种数：10 种起步，每 2 关 +1 种，封顶 18 种
     *   - 每种图案对数：自动计算，图案总数约占棋盘 80%
     *   - 初始解锁：随机 4~6 对相邻图案
     */
    private static generateLevel(levelId: number): LevelConfig {
        // 【需求】棋盘尺寸/图案种数/初始对数量按难度固定（6 关起全困难）
        const difficulty = this.getDifficultyByLevel(levelId);
        const p = this.getBoardParams(difficulty);
        const rows = p.rows;
        const cols = p.cols;
        const iconTypes = p.iconTypes;
        const pairCount = p.pairCount;

        // ===== 生成相邻的初始解锁位置 =====
        const initialUnlocked = this.generateInitialPairs(rows, cols, pairCount);

        Logger.log(`LevelManager.generateLevel: 生成第${levelId}关 ` +
            `${rows}×${cols}，${iconTypes}种图案，初始${pairCount}对，难度=${difficulty}`);

        return {
            levelId,
            difficulty,
            rows,
            cols,
            iconTypes,
            initialUnlocked,
        };
    }

    /**
     * 生成相邻的初始解锁位置对
     * 
     * 从 9 个候选模板（四角、四边中点、中心）中随机选取，
     * 每对的两个格子都相邻（保证开局必然可消除）
     */
    private static generateInitialPairs(
        rows: number, cols: number, pairCount: number,
    ): { row: number; col: number }[] {
        // 棋盘中间坐标
        const midR = Math.floor(rows / 2);
        const midC = Math.floor(cols / 2);

        // ===== 候选相邻对模板（9 对） =====
        const candidates: [number, number][][] = [
            [[0, 0], [0, 1]],                                // 左上角（横）
            [[0, cols - 2], [0, cols - 1]],                  // 右上角（横）
            [[rows - 1, 0], [rows - 1, 1]],                  // 左下角（横）
            [[rows - 1, cols - 2], [rows - 1, cols - 1]],    // 右下角（横）
            [[0, midC - 1], [0, midC]],                      // 上边中点（横）
            [[rows - 1, midC - 1], [rows - 1, midC]],        // 下边中点（横）
            [[midR, 0], [midR, 1]],                          // 左边中点（横）
            [[midR, cols - 2], [midR, cols - 1]],            // 右边中点（横）
            [[midR - 1, midC - 1], [midR - 1, midC]],        // 中心偏上（横）
        ];

        // ===== Fisher-Yates 洗牌 =====
        const shuffled = [...candidates];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // ===== 取前 pairCount 对，展开成平铺坐标数组 =====
        const result: { row: number; col: number }[] = [];
        const takeCount = Math.min(pairCount, shuffled.length);
        for (let i = 0; i < takeCount; i++) {
            result.push({ row: shuffled[i][0][0], col: shuffled[i][0][1] });
            result.push({ row: shuffled[i][1][0], col: shuffled[i][1][1] });
        }

        return result;
    }
}