// ============================================================
// assets/scripts/core/PathFinder.ts   【修复版 v2】
// 连通检测算法（连连看核心算法）
//
// 本次修复记录：
//   1.【崩溃修复】isPassable 限制外圈范围为 [-1, rows]×[-1, cols]，
//     防止 BFS 无限向外扩散导致 visited 数组越界
//   2.【逻辑修复】起点以 direction=-1（无方向）入队一次，
//     修复"第一步走非预设方向被多算1个拐角"的误判问题
//   3.【防御加固】访问 visited 前增加边界检查（双保险）
// ============================================================

// 引入棋盘管理器和格子数据结构（用于判断哪些位置可通过）
import { BoardManager } from './BoardManager';
import { CellState } from '../data/CellData';

// ==================== 路径节点接口 ====================

/**
 * BFS 搜索过程中的状态节点
 */
interface PathNode {
    row: number;         // 当前所在行（-1 ~ rows，越界表示棋盘外圈）
    col: number;         // 当前所在列（-1 ~ cols，越界表示棋盘外圈）
    direction: number;   // 当前行进方向：-1=起点(还没迈步), 0=右, 1=下, 2=左, 3=上
    turns: number;       // 到目前为止拐过的弯数（0~2）
    path: { row: number; col: number }[];  // 从起点到当前位置经过的所有坐标（含起点）
}

export class PathFinder {

    // ==================== 方向常量 ====================

    /**
     * 四个方向的坐标偏移量
     * 索引对应：0=右, 1=下, 2=左, 3=上
     * 例如向右走一步：行不变，列 +1
     */
    private static readonly DIRS: [number, number][] = [
        [0, 1],    // 方向0：右
        [1, 0],    // 方向1：下
        [0, -1],   // 方向2：左
        [-1, 0],   // 方向3：上
    ];

    /** 允许的最大拐弯次数（连连看标准规则 = 2） */
    private static readonly MAX_TURNS = 2;

    // ==================== 公开方法 ====================

    /**
     * 检测两个格子是否可连通（供外部直接调用）
     * 
     * 性能说明：这里走【轻量 BFS】（不复制路径数组，只判断连通性），
     * 因为 MatchChecker 会频繁调用（每步消除后做卡死检测），
     * 路径复制在这种热点路径上是纯浪费。
     * 
     * @param board 棋盘数据管理器
     * @param row1 起点行号
     * @param col1 起点列号
     * @param row2 终点行号
     * @param col2 终点列号
     * @returns true=可连通（≤2拐角），false=不可连通
     */
    public static canConnect(
        board: BoardManager,
        row1: number, col1: number,
        row2: number, col2: number,
    ): boolean {
        return this.findPathLight(board, row1, col1, row2, col2);
    }

    /**
     * 查找两个格子之间的连通路径
     * 
     * @param board 棋盘数据管理器
     * @param row1 起点行号
     * @param col1 起点列号
     * @param row2 终点行号
     * @param col2 终点列号
     * @returns 路径坐标数组（含起点和终点）；找不到返回 null
     */
    public static findPath(
        board: BoardManager,
        row1: number, col1: number,
        row2: number, col2: number,
    ): { row: number; col: number }[] | null {

        // ===== 前置检查1：起点和终点不能是同一个格子 =====
        if (row1 === row2 && col1 === col2) {
            return null; // 同一个格子不构成配对
        }

        // ===== 前置检查2：起点和终点必须都存在于棋盘内 =====
        const startCell = board.getCell(row1, col1);
        const endCell = board.getCell(row2, col2);
        if (!startCell || !endCell) {
            return null; // 越界了，无法检测
        }

        // 获取棋盘尺寸（用于限制 visited 数组大小）
        const rows = board.getRows();
        const cols = board.getCols();

        // ===== 创建 visited 数组（剪枝用） =====
        // visited[row+1][col+1][dir] 表示：
        // "以 dir 方向到达 (row, col) 这个位置时，所用到的最少拐弯次数"
        // 初始值为 -1 表示"从未到达过"
        // 
        // 为什么要 row+1 和 col+1？
        // 因为路径允许贴着棋盘外绕一圈，
        // 坐标范围是 [-1, rows] × [-1, cols]（比棋盘大一圈），
        // 用 +1 平移把 -1 映射到索引 0，方便数组存储。
        const visited: number[][][] = [];
        for (let r = -1; r <= rows; r++) {
            // 为每一行（含上下外圈）创建行数组
            visited[r + 1] = [];
            for (let c = -1; c <= cols; c++) {
                // 每个位置存储4个方向的记录，初始都是 -1（未访问）
                visited[r + 1][c + 1] = [-1, -1, -1, -1];
            }
        }

        // ===== 创建 BFS 队列，并把起点入队 =====
        // 【修复②】起点 direction = -1（还没有行进方向）
        // 这样从起点迈出的第一步无论走哪个方向都不会被算作拐弯
        // 且起点只需要入队一次
        const queue: PathNode[] = [
            {
                row: row1,
                col: col1,
                direction: -1,          // -1 = 无方向
                turns: 0,               // 还没拐过弯
                path: [{ row: row1, col: col1 }],  // 路径只包含起点
            },
        ];

        // ===== BFS 主循环 =====
        // 只要队列不为空就继续搜索
        while (queue.length > 0) {
            // 取出队首状态
            const current = queue.shift()!;

            // ===== 遍历四个方向，尝试各走一步 =====
            for (let dir = 0; dir < 4; dir++) {
                // 计算当前方向的偏移量
                const [dr, dc] = this.DIRS[dir];
                // 迈出一步后的新坐标
                const nextRow = current.row + dr;
                const nextCol = current.col + dc;

                // ===== 计算新状态的拐弯次数 =====
                let newTurns = current.turns;
                // 规则：换了方向（且不在起点）→ 拐弯次数 +1
                if (current.direction !== -1 && dir !== current.direction) {
                    newTurns = current.turns + 1;
                }
                // 拐弯次数超过2，直接放弃这个方向（剪枝）
                if (newTurns > this.MAX_TURNS) {
                    continue;
                }

                // ===== 检查是否到达终点 =====
                if (nextRow === row2 && nextCol === col2) {
                    // 找到路径！把终点坐标追加到路径末尾并返回
                    const fullPath = [...current.path, { row: nextRow, col: nextCol }];
                    return fullPath;
                }

                // ===== 检查新位置是否可通过 =====
                // 可通过 = 棋盘外圈（仅一层）或棋盘内的空白格（EMPTY）
                if (!this.isPassable(board, nextRow, nextCol)) {
                    continue; // 不可通行，这个方向走不通
                }

                // =====【修复③】防御性边界检查（双保险） =====
                // 理论上 isPassable 已经把坐标限制在合法范围内，
                // 这里再检查一次，防止任何意外越界导致崩溃
                const rowIdx = nextRow + 1;  // 转换到 visited 的行索引
                const colIdx = nextCol + 1;  // 转换到 visited 的列索引
                if (rowIdx < 0 || rowIdx >= visited.length) {
                    continue; // 行索引越界，跳过（不会发生，但保险）
                }
                if (colIdx < 0 || colIdx >= visited[rowIdx].length) {
                    continue; // 列索引越界，跳过（不会发生，但保险）
                }

                // ===== visited 剪枝检查 =====
                // 如果之前已经以更少（或相同）的拐弯次数到达过这个位置的
                // 相同方向状态，说明继续搜下去不会得到更好的结果，跳过
                const record = visited[rowIdx][colIdx][dir];
                if (record !== -1 && record <= newTurns) {
                    continue; // 剪枝：不是更优的到达方式
                }
                // 记录本次到达的拐弯次数
                visited[rowIdx][colIdx][dir] = newTurns;

                // ===== 新状态入队，继续搜索 =====
                queue.push({
                    row: nextRow,
                    col: nextCol,
                    direction: dir,       // 当前行进方向更新为本次迈步方向
                    turns: newTurns,      // 更新后的拐弯次数
                    path: [...current.path, { row: nextRow, col: nextCol }],  // 路径追加新坐标
                });
            }
        }

        // ===== 队列搜索完毕仍未到达终点 =====
        // 说明不存在 ≤2 拐角的路径
        return null;
    }

    /**
     * 【轻量版】仅判断两个格子是否可连通（≤2 拐角），不记录路径
     * 
     * 与 findPath 的搜索逻辑完全一致（同样的外圈通行、同样的 visited 剪枝），
     * 唯一区别：队列状态不携带 path 数组，省去每一步的数组复制开销。
     * 供 canConnect / MatchChecker 这类高频连通性检测使用。
     * 
     * @param board 棋盘数据管理器
     * @param row1 起点行号
     * @param col1 起点列号
     * @param row2 终点行号
     * @param col2 终点列号
     * @returns true=可连通，false=不可连通
     */
    private static findPathLight(
        board: BoardManager,
        row1: number, col1: number,
        row2: number, col2: number,
    ): boolean {
        // ===== 前置检查：同格 / 越界 =====
        if (row1 === row2 && col1 === col2) {
            return false;
        }
        const startCell = board.getCell(row1, col1);
        const endCell = board.getCell(row2, col2);
        if (!startCell || !endCell) {
            return false;
        }

        const rows = board.getRows();
        const cols = board.getCols();

        // ===== visited 剪枝表（与 findPath 相同） =====
        const visited: number[][][] = [];
        for (let r = -1; r <= rows; r++) {
            visited[r + 1] = [];
            for (let c = -1; c <= cols; c++) {
                visited[r + 1][c + 1] = [-1, -1, -1, -1];
            }
        }

        // ===== BFS 队列（不存 path） =====
        const queue: { row: number; col: number; direction: number; turns: number }[] = [
            { row: row1, col: col1, direction: -1, turns: 0 },
        ];

        while (queue.length > 0) {
            const current = queue.shift()!;

            for (let dir = 0; dir < 4; dir++) {
                const [dr, dc] = this.DIRS[dir];
                const nextRow = current.row + dr;
                const nextCol = current.col + dc;

                // 拐弯计数与剪枝
                let newTurns = current.turns;
                if (current.direction !== -1 && dir !== current.direction) {
                    newTurns = current.turns + 1;
                }
                if (newTurns > this.MAX_TURNS) {
                    continue;
                }

                // 到达终点即可判定连通
                if (nextRow === row2 && nextCol === col2) {
                    return true;
                }

                // 通行检查（含外圈）
                if (!this.isPassable(board, nextRow, nextCol)) {
                    continue;
                }

                // 防御性边界检查
                const rowIdx = nextRow + 1;
                const colIdx = nextCol + 1;
                if (rowIdx < 0 || rowIdx >= visited.length) continue;
                if (colIdx < 0 || colIdx >= visited[rowIdx].length) continue;

                // visited 剪枝
                const record = visited[rowIdx][colIdx][dir];
                if (record !== -1 && record <= newTurns) continue;
                visited[rowIdx][colIdx][dir] = newTurns;

                queue.push({ row: nextRow, col: nextCol, direction: dir, turns: newTurns });
            }
        }

        return false;
    }

    // ==================== 私有方法 ====================

    /**
     * 判断某个坐标位置是否可通行
     * 
     * 规则（按顺序判断）：
     *   1. 超出外圈（棋盘外一圈之外）→ 不可通行
     *   2. 外圈（棋盘外的一圈，坐标恰好是 -1 或 rows/cols）→ 可通行
     *   3. 棋盘内 → 只有 EMPTY（空白）状态可通行
     * 
     * 【修复①核心】第1条规则是本次崩溃的关键修复：
     * 旧代码把"所有棋盘外"都视为可通行，导致 BFS 无限向外扩散，
     * 最终 visited 数组越界崩溃。
     * 现在把可通行范围严格限制在外圈一层，
     * 正好等于 visited 数组覆盖的范围，永不越界。
     * 
     * @param board 棋盘数据管理器
     * @param row 行号（可能越界）
     * @param col 列号（可能越界）
     * @returns true=可通行
     */
    private static isPassable(board: BoardManager, row: number, col: number): boolean {
        // 获取棋盘尺寸
        const rows = board.getRows();
        const cols = board.getCols();

        // ===== 规则1：超出外圈范围 → 不可通行 =====
        // 合法坐标范围：row ∈ [-1, rows]，col ∈ [-1, cols]
        // 这是"棋盘 + 外圈一层"，正好等于 visited 数组的覆盖范围
        if (row < -1 || row > rows || col < -1 || col > cols) {
            return false; // 走得太远了，不允许
        }

        // ===== 规则2：外圈（棋盘外但坐标合法）→ 可通行 =====
        // 尝试获取这个位置的格子数据
        const cell = board.getCell(row, col);
        if (!cell) {
            // getCell 返回 null 说明坐标在棋盘外（但已在规则1中确认是外圈）
            // 外圈可通行，这是"允许贴边绕行"的连连看标准规则
            return true;
        }

        // ===== 规则3：棋盘内 → 只有空白格可通行 =====
        // 有图案的格子（LOCKED/UNLOCKED/SELECTED/REMOVING）都不可通行
        return cell.state === CellState.EMPTY;
    }
}