//格子数据结构
/**
 * 格子状态枚举
 * 决定格子在棋盘上的视觉表现和交互行为
 */
export enum CellState {
    LOCKED,      // 锁定（不可点击，灰色蒙版）
    UNLOCKED,    // 已解锁（正常显示，可点击）
    SELECTED,    // 被选中（高亮边框）
    REMOVING,    // 消除动画中
    EMPTY,       // 已消除（空地）
}

/**
 * 单个格子的完整数据
 * BoardManager 持有二维数组 CellData[][]
 * Cell 组件持有单个 CellData 引用并据此渲染
 * 
 * 【清理】纯数据类：不再继承 Component / 不挂 @ccclass
 */
export class CellData {
    row: number;
    col: number;
    iconType: number;    // 0=空，1~15=图案种类ID
    state: CellState;
    constructor(row: number, col: number, iconType: number = 0, state: CellState = CellState.EMPTY) {
        this.row = row;
        this.col = col;
        this.iconType = iconType;
        this.state = state;
    }
}
