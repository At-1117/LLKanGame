// ============================================================
// assets/scripts/data/LevelData.ts   【完整新版·第四阶段B】
// 关卡配置数据结构定义
// ============================================================

/**
 * 单个关卡的配置接口
 * 
 * 字段说明：
 *   - rows/cols: 棋盘行列数（关卡难度递增：从小棋盘到大棋盘）
 *   - iconTypes: 本关使用的图案种类数量
 *   - initialUnlocked: 初始解锁位置，【必须成对出现且每对相邻】
 */
export interface LevelConfig {
    levelId: number;         // 关卡编号（从1开始）
    rows: number;            // 棋盘行数
    cols: number;            // 棋盘列数
    iconTypes: number;       // 图案种类数量（1~15）
    initialUnlocked: { row: number; col: number }[];   // 初始解锁位置（两两一组成相邻对）

    timeLimit?: number;      // 限时（秒，可选，暂未使用）
    scoreTarget?: number;    // 目标分数（可选，暂未使用）

    /** 【第六阶段新增】关卡难度：easy=简单 / normal=普通 / hard=困难（决定奖励步数 x） */
    difficulty?: 'easy' | 'normal' | 'hard';
}