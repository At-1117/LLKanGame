import { BoardManager } from './BoardManager';
import { PathFinder } from './PathFinder';
import { CellData, CellState } from '../data/CellData';

// ============================================================
// assets/scripts/core/MatchChecker.ts
// 全局可消除对检测器（卡死判断）
// 静态工具类，不需要挂载节点
// 用途：
//   1. 检测当前棋盘是否卡死（没有任何可消除的对）
//   2. 查找一对可消除的图案（供"提示"道具使用）
// ============================================================

// ==================== 匹配结果接口 ====================

/**
 * 一对可消除格子的坐标信息
 */
export interface MatchPair {
    row1: number;   // 第一个格子的行号
    col1: number;   // 第一个格子的列号
    row2: number;   // 第二个格子的行号
    col2: number;   // 第二个格子的列号
}

export class MatchChecker {

    /**
     * 在棋盘中查找一对可消除的相同图案
     * 
     * 查找逻辑：
     * 1. 收集所有"已解锁"状态的格子，并按图案类型分组
     * 2. 只在【同一组】内两两配对：图案类型相同 + PathFinder 判定连通 → 可消除对
     * 3. 返回找到的第一对（遍历顺序从上到下、从左到右）
     * 
     * 性能优化【v2】：
     * 旧实现是"所有解锁格子两两组合"再比对图案（O(n²) 组合，含大量图案不同的无效组合），
     * 现改为按图案分组后组内配对，组合数从 C(n,2) 降为 Σ C(nᵢ,2)（nᵢ 为同图案格子数），
     * 同时连通判定走轻量 BFS（不复制路径数组），手机端卡死检测开销显著降低。
     * 
     * @param board 棋盘数据管理器
     * @returns 可消除对的坐标；找不到返回 null（即卡死）
     */
    public static findOneMatch(board: BoardManager): MatchPair | null {

        // ===== 第一步：按图案类型分组收集所有已解锁格子 =====
        // （SELECTED 状态也算已解锁，保险起见一并收集）
        const groups = new Map<number, CellData[]>();

        for (let row = 0; row < board.getRows(); row++) {
            for (let col = 0; col < board.getCols(); col++) {
                const cell = board.getCell(row, col);
                if (!cell) continue; // 越界（正常不会发生）

                // 只收集解锁或选中状态的格子
                if (cell.state === CellState.UNLOCKED ||
                    cell.state === CellState.SELECTED) {
                    let group = groups.get(cell.iconType);
                    if (!group) {
                        group = [];
                        groups.set(cell.iconType, group);
                    }
                    group.push(cell);
                }
            }
        }

        // ===== 第二步：同组内两两配对检查 =====
        // 图案类型不同必然无法消除，直接跳过（分组后天然排除）
        for (const group of groups.values()) {
            for (let i = 0; i < group.length; i++) {
                const cellA = group[i];
                // 内层循环：遍历 i 之后的所有格子（避免重复检查 A-B 和 B-A）
                for (let j = i + 1; j < group.length; j++) {
                    const cellB = group[j];

                    // ===== 条件：路径必须连通（≤2拐角） =====
                    if (PathFinder.canConnect(
                        board,
                        cellA.row, cellA.col,
                        cellB.row, cellB.col,
                    )) {
                        // 连通，找到一对！
                        return {
                            row1: cellA.row,
                            col1: cellA.col,
                            row2: cellB.row,
                            col2: cellB.col,
                        };
                    }
                }
            }
        }

        // ===== 所有组合都检查完毕，没有可消除对 =====
        return null; // 棋盘卡死！
    }

    /**
     * 判断当前棋盘是否卡死
     * 
     * @param board 棋盘数据管理器
     * @returns true=卡死（没有可消除对），false=正常
     */
    public static isStuck(board: BoardManager): boolean {
        // 卡死 = 找不到任何可消除对
        return this.findOneMatch(board) === null;
    }
}