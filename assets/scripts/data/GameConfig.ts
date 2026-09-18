import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

//全局常量
@ccclass('GameConfig')
export class GameConfig extends Component {
// 设计分辨率
    static readonly DESIGN_WIDTH = 750;
    static readonly DESIGN_HEIGHT = 1334;
    // 棋盘参数（关卡可变，这里给默认值）
    static readonly DEFAULT_ROWS = 6;
    static readonly DEFAULT_COLS = 6;
    static readonly CELL_SIZE = 100;          // 格子尺寸（像素）
    static readonly CELL_GAP = 4;            // 间距
    // 解锁扩散范围（8方向）
    static readonly UNLOCK_DIRECTIONS: [number, number][] = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1],
    ];
    // 道具 ID
    static readonly PROP_HINT = 'hint';       // 提示
    static readonly PROP_SHUFFLE = 'shuffle'; // 重排
    static readonly PROP_BOMB = 'bomb';       // 炸弹（消除任意一对）

    // ==================== 道具配置 ====================
    /** 每关开始时每种道具的初始数量 */
    static readonly INITIAL_PROP_COUNT = 3;
    /** 提示道具的高亮动画持续时间（秒） */
    static readonly HINT_DURATION = 2;

    // ==================== 步数与难度 ====================

    /** 难度对应的奖励步数（x 值） */
    static readonly DIFFICULTY_BONUS: Record<string, number> = {
        easy: 20,     // 简单：容错 20 步
        normal: 10,   // 普通：容错 10 步
        hard: 5,      // 困难：容错 5 步
    };

    // ==================== 血量系统 ====================

    /** 最大心数 */
    static readonly MAX_HEARTS = 5;

    /** 每颗心的恢复时间（毫秒）：10 分钟 */
    static readonly HEART_RECOVER_INTERVAL = 10 * 60 * 1000;

    // ==================== 技能配置 ====================
    /** 解锁技能的持续时间（秒） */
    static readonly SKILL_UNLOCK_DURATION = 5;

    /** 解锁技能的道具ID */
    static readonly PROP_SKILL = 'skill';

    
    // 抖音广告位 ID（需替换为真实值）
    static readonly AD_VIDEO_ID = 'your_video_placement_id';
    static readonly AD_INTERSTITIAL_ID = 'your_interstitial_id';
}


