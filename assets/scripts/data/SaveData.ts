// ============================================================
// assets/scripts/data/SaveData.ts   【完整新版·第六阶段】
// 存档数据结构
// ============================================================

/**
 * 设置项
 */
export interface SettingsData {
    soundOn: boolean;        // 音效开关
    musicOn: boolean;        // 背景音乐开关
    vibrationOn: boolean;    // 震动开关
}

/**
 * 玩家存档
 */
export interface PlayerSaveData {
    /** 当前进行中的关卡（未完成的关卡；通关后 +1） */
    currentLevel: number;

    /** 每关历史最高星级 */
    stars: { [levelId: number]: number };

    /** 当前心数（0~5） */
    hearts: number;

    /** 上次恢复心的时刻（毫秒时间戳） */
    lastHeartTime: number;

    /** 设置项 */
    settings: SettingsData;

    /** 道具（暂未跨关保存，保留字段） */
    props: { [propId: string]: number };

    /** 总分（已废弃，保留兼容） */
    totalScore: number;

    /** 每关的棋盘种子（保证重玩/重进同一关时布局一致） */
    levelSeeds: { [levelId: number]: number };
}