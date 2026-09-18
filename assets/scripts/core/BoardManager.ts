import { CellData, CellState } from '../data/CellData';
import { LevelConfig } from '../data/LevelData';
import { GameConfig } from '../data/GameConfig';
import { Logger } from '../utils/Logger';

// ============================================================
// assets/scripts/core/BoardManager.ts
// 棋盘数据管理器（纯逻辑层，不处理渲染）
// 负责：生成棋盘、修改格子状态、查询格子
// ============================================================
export class BoardManager {

    // ==================== 私有属性 ====================

    // 当前关卡配置
    private _levelConfig: LevelConfig | null = null;

    // 棋盘二维数组（核心数据）
    // _cells[row][col] → CellData
    private _cells: CellData[][] = [];

    // 棋盘行数
    private _rows: number = 0;

    // 棋盘列数
    private _cols: number = 0;

    // 当前已解锁的格子数量（用于判断通关条件）
    private _unlockedCount: number = 0;

    // 剩余未消除的格子数量
    private _remainingCount: number = 0;

    /** 随机数生成函数（支持种子，保证重开布局一致） */
    private _random: () => number = Math.random;

    // ==================== 公开方法 ====================

    /**
     * 根据关卡配置初始化棋盘数据
     * 
     * 生成流程：
     *   1. 创建空棋盘（全部 EMPTY）
     *   2. 收集并校验初始解锁位置
     *   3. 初始解锁位置整理成"对"（两两一组）
     *   4. 给每对分配相同图案（优先消耗不同图案类型）
     *   5. 剩余图案随机填充到剩余位置
     *   6. 设置状态：初始解锁 → UNLOCKED，其余有图案 → LOCKED，无图案 → EMPTY
     * 
     * @param config 关卡配置对象
     */
    public initBoard(config: LevelConfig, seed?: number): void {
        // 保存关卡配置
        this._levelConfig = config;
        this._rows = config.rows;
        this._cols = config.cols;

        // ===== 设置随机数（种子相同 → 布局相同）=====
        if (seed !== undefined && seed > 0) {
            // 线性同余伪随机数（LCG）：同一个种子产生同一串随机数
            let state = seed % 233280;
            this._random = () => {
                state = (state * 9301 + 49297) % 233280;
                return state / 233280;
            };
        } else {
            this._random = Math.random;
        }

        // ===== 第一步：创建空棋盘 =====
        // 所有格子初始为 EMPTY（iconType=0，无图案）
        this._cells = [];
        for (let row = 0; row < this._rows; row++) {
            this._cells[row] = [];
            for (let col = 0; col < this._cols; col++) {
                this._cells[row][col] = new CellData(row, col, 0, CellState.EMPTY);
            }
        }
        // ===== 第二步：收集并校验初始解锁位置 =====
        // 【修复①】先收集这些位置，后面优先给它们分配图案
        const initialCells = this.collectInitialUnlockedCells(config);
        // ===== 第三步：把初始解锁位置整理成"对"（两两一组） =====
        // 约定：initialUnlocked 数组必须成对出现
        // 第 0、1 个为一对，第 2、3 个为一对，以此类推
        // 每对的两个位置必须相邻（上下或左右），才能保证开局可消除
        const initialPairs: CellData[][] = [];
        for (let i = 0; i + 1 < initialCells.length; i += 2) {
            initialPairs.push([initialCells[i], initialCells[i + 1]]);
        }
        // 如果初始解锁位置是奇数个，最后一个落单，发出警告
        if (initialCells.length % 2 === 1) {
            Logger.warn(`BoardManager.initBoard: 初始解锁位置共 ${initialCells.length} 个（奇数），` +
                `最后一个位置 (${initialCells[initialCells.length - 1].row},` +
                `${initialCells[initialCells.length - 1].col}) 将不被解锁，请检查关卡配置`);
        }
        // ===== 第四步：给每个初始解锁对分配相同的图案【修复②】 =====
        // 建立"图案类型 → 剩余可用个数"表
        const remaining = this.buildRemainingIconCounts(config);
        for (const pair of initialPairs) {
            // 找一种剩余数量 >= 2 的图案类型（优先用不同类型的图案，增加视觉多样性）
            const chosenType = this.pickIconTypeWithEnough(remaining, 2);
            // 图案不够用了，无法给所有初始对分配，直接报错返回
            if (chosenType === -1) {
                Logger.error('BoardManager.initBoard: 图案数量不足，无法给所有初始解锁对分配相同图案');
                return;
            }
            // 同对的两个格子分配相同图案 → 相邻直连必然可消除
            pair[0].iconType = chosenType;
            pair[1].iconType = chosenType;
            // 从剩余数量中扣除 2 个
            remaining.set(chosenType, (remaining.get(chosenType) ?? 0) - 2);
        }
        // ===== 第五步：把剩余的图案随机填充到其余位置 =====
        // 收集剩余图案列表
        const restIcons: number[] = [];
        for (const [iconType, count] of remaining) {
            // 每种图案按剩余个数逐个加入列表
            for (let i = 0; i < count; i++) {
                restIcons.push(iconType);
            }
        }
        // 打乱剩余图案顺序
        this.shuffleArray(restIcons);
        // 收集尚未分配图案的位置（iconType 还是 0 的位置）
        const restPositions: { row: number; col: number }[] = [];
        for (let row = 0; row < this._rows; row++) {
            for (let col = 0; col < this._cols; col++) {
                const cell = this._cells[row][col];
                if (cell.iconType === 0) {
                    restPositions.push({ row, col });
                }
            }
        }
        // 打乱剩余位置顺序
        this.shuffleArray(restPositions);
        // 填充：以图案数和位置数的较小值为准（正常两者相等）
        const fillCount = Math.min(restIcons.length, restPositions.length);
        for (let i = 0; i < fillCount; i++) {
            const pos = restPositions[i];
            this._cells[pos.row][pos.col].iconType = restIcons[i];
        }
        // ===== 第六步：设置格子状态 =====
        // 用 Set 快速查询"这个位置是不是初始解锁位置"
        const initialSet = new Set<string>();
        for (const cell of initialCells) {
            initialSet.add(`${cell.row},${cell.col}`);
        }
        for (let row = 0; row < this._rows; row++) {
            for (let col = 0; col < this._cols; col++) {
                const cell = this._cells[row][col];
                if (cell.iconType > 0) {
                    // 有图案的格子：初始解锁位置 → UNLOCKED，其余 → LOCKED
                    cell.state = initialSet.has(`${row},${col}`)
                        ? CellState.UNLOCKED
                        : CellState.LOCKED;
                } else {
                    // 无图案的格子：保持 EMPTY（棋盘上的空位）
                    cell.state = CellState.EMPTY;
                }
            }
        }
        // ===== 第七步：更新统计计数 =====
        this.updateCounts();
        Logger.log(`BoardManager.initBoard: 棋盘初始化完成，` +
            `${this._rows}×${this._cols}，` +
            `初始解锁 ${initialPairs.length} 对，` +
            `剩余待消除: ${this._remainingCount}`);
    }

    /**
     * 获取指定位置的格子数据
     * @param row 行号（从0开始）
     * @param col 列号（从0开始）
     * @returns CellData | null（越界返回 null）
     */
    public getCell(row: number, col: number): CellData | null {
        // 边界检查
        if (row < 0 || row >= this._rows || col < 0 || col >= this._cols) {
            return null;
        }
        return this._cells[row][col];
    }

    /**
     * 获取整个棋盘二维数组
     * @returns CellData[][]
     */
    public getAllCells(): CellData[][] {
        return this._cells;
    }

    /**
     * 获取棋盘行数
     */
    public getRows(): number {
        return this._rows;
    }

    /**
     * 获取棋盘列数
     */
    public getCols(): number {
        return this._cols;
    }

    /**
     * 获取已解锁格子数量
     */
    public getUnlockedCount(): number {
        return this._unlockedCount;
    }

    /**
     * 获取剩余未消除格子数量
     */
    public getRemainingCount(): number {
        return this._remainingCount;
    }

    /**
     * 将指定位置及其周围8格解锁
     * 核心玩法逻辑：消除一对图案后，这对图案周围一圈的锁定格子变为解锁
     * 
     * @param row 被消除格子的行号
     * @param col 被消除格子的列号
     * @returns 新解锁的格子列表（用于播放解锁动画）
     */
    public unlockAround(row: number, col: number): CellData[] {
        // 存储新解锁的格子
        const newlyUnlocked: CellData[] = [];

        // 遍历8个方向的偏移量（从 GameConfig 读取）
        for (const [dr, dc] of GameConfig.UNLOCK_DIRECTIONS) {
            // 计算邻居坐标
            const nr = row + dr;
            const nc = col + dc;

            // 边界检查
            if (nr < 0 || nr >= this._rows || nc < 0 || nc >= this._cols) {
                continue; // 越界了，跳过
            }

            // 获取邻居格子
            const neighbor = this._cells[nr][nc];

            // 只处理锁定状态的格子
            if (neighbor.state === CellState.LOCKED) {
                // 修改状态为解锁
                neighbor.state = CellState.UNLOCKED;
                // 加入新解锁列表
                newlyUnlocked.push(neighbor);
            }
        }

        // 更新统计计数
        this.updateCounts();

        // 返回新解锁的格子列表（外部用于播放动画和判断）
        return newlyUnlocked;
    }

    /**
     * 将指定位置的格子标记为消除
     * @param row 行号
     * @param col 列号
     */
    public removeCell(row: number, col: number): void {
        const cell = this.getCell(row, col);
        if (cell) {
            // 先设为 REMOVING 状态（触发消除动画）
            cell.state = CellState.REMOVING;
        }
    }

    /**
     * 将指定位置的格子完全清除（动画结束后调用）
     * @param row 行号
     * @param col 列号
     */
    public clearCell(row: number, col: number): void {
        const cell = this.getCell(row, col);
        if (cell) {
            // 设为空白状态
            cell.state = CellState.EMPTY;
            cell.iconType = 0;
        }
        // 更新计数
        this.updateCounts();
    }

    /**
     * 检查是否所有格子都已消除（通关条件）
     * @returns boolean
     */
    public isAllCleared(): boolean {
        return this._remainingCount === 0;
    }

    // ==================== 私有方法 ====================

    /**
     * 更新统计计数
     * 遍历棋盘，统计各状态的数量
     */
    private updateCounts(): void {
        this._unlockedCount = 0;
        this._remainingCount = 0;

        for (let row = 0; row < this._rows; row++) {
            for (let col = 0; col < this._cols; col++) {
                const cell = this._cells[row][col];
                // 统计已解锁数量
                if (cell.state === CellState.UNLOCKED || cell.state === CellState.SELECTED) {
                    this._unlockedCount++;
                }
                // 统计剩余未消除数量（有图案且未消除的格子）
                if (cell.iconType > 0 &&
                    cell.state !== CellState.EMPTY &&
                    cell.state !== CellState.REMOVING) {
                    this._remainingCount++;
                }
            }
        }
    }

    /**
     * 【新增辅助方法】收集并校验初始解锁位置对应的格子
     * 
     * 校验内容：
     *   1. 坐标越界 → 忽略并警告
     *   2. 坐标重复 → 忽略并警告
     * 
     * @param config 关卡配置
     * @returns 有效的初始解锁格子列表
     */
    private collectInitialUnlockedCells(config: LevelConfig): CellData[] {
        const result: CellData[] = [];
        // 用 Set 记录已收集的位置，防止重复
        const seen = new Set<string>();
        for (const pos of config.initialUnlocked) {
            // ===== 越界检查 =====
            if (pos.row < 0 || pos.row >= this._rows || pos.col < 0 || pos.col >= this._cols) {
                Logger.warn(`BoardManager.collectInitialUnlockedCells: ` +
                    `初始解锁位置越界 (${pos.row}, ${pos.col})，已忽略`);
                continue;
            }
            // ===== 重复检查 =====
            const key = `${pos.row},${pos.col}`;
            if (seen.has(key)) {
                Logger.warn(`BoardManager.collectInitialUnlockedCells: ` +
                    `初始解锁位置重复 (${pos.row}, ${pos.col})，已忽略`);
                continue;
            }
            seen.add(key);
            // 通过校验，加入列表
            result.push(this._cells[pos.row][pos.col]);
        }
        return result;
    }
    /**
     * 【新增辅助方法】建立"图案类型 → 剩余可用个数"表
     * 
     * 每种图案类型的总个数按棋盘格数均分（棋盘 100% 填满）
     * 
     * @param config 关卡配置
     * @returns Map：key=图案类型编号（1~iconTypes），value=剩余个数
     */
    private buildRemainingIconCounts(config: LevelConfig): Map<number, number> {
        // ===== 【修改】图案填满整个棋盘，不留空格 =====
        const map = new Map<number, number>();

        // 棋盘总对数 = 格子数 / 2
        const totalPairs = Math.floor((this._rows * this._cols) / 2);
        // 每种图案的基础对数
        const basePairs = Math.floor(totalPairs / config.iconTypes);
        // 余数对（前几种图案各多一对）
        const extraPairs = totalPairs - basePairs * config.iconTypes;

        for (let iconType = 1; iconType <= config.iconTypes; iconType++) {
            // 每种图案的对数（前 extraPairs 种多 1 对）
            const pairs = basePairs + (iconType <= extraPairs ? 1 : 0);
            // 总个数 = 对数 × 2
            map.set(iconType, pairs * 2);
        }

        return map;
    }

    /**
     * 【新增辅助方法】找一种剩余数量 >= need 的图案类型
     * 
     * 按类型编号从小到大找（这样初始对会优先使用不同类型的图案，
     * 比如第1对用类型1、第2对用类型2……视觉上更丰富）
     * 
     * @param remaining 图案剩余数量表
     * @param need 需要的最少个数（初始对需要 2 个）
     * @returns 找到的图案类型编号；找不到返回 -1
     */
    private pickIconTypeWithEnough(remaining: Map<number, number>, need: number): number {
        // 取出所有类型编号并从小到大排序
        const types = Array.from(remaining.keys()).sort((a, b) => a - b);
        for (const iconType of types) {
            // 剩余数量足够就返回这个类型
            if ((remaining.get(iconType) ?? 0) >= need) {
                return iconType;
            }
        }
        // 没有任何类型剩余足够
        return -1;
    }

    /**
     * Fisher-Yates 洗牌算法
     * 将数组中的元素随机打乱（原地修改）
     * 
     * 原理：
     * 从数组末尾开始，每次随机选一个前面的元素与当前元素交换
     * 时间复杂度 O(n)，保证每种排列概率均等
     * 
     * @param array 需要打乱的数组
     */
    private shuffleArray<T>(array: T[]): void {
        // 从最后一个元素开始向前遍历
        for (let i = array.length - 1; i > 0; i--) {
            // 随机选取一个索引 j（范围 0 到 i）
            const j = Math.floor(this._random() * (i + 1));
            // 交换 array[i] 和 array[j]
            const temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
    }

    public shuffleRemainingIcons(): void {
        // ===== 第一步：收集所有"还活着"的格子 =====
        const iconTypes: number[] = [];                    // 收集图案类型
        const positions: { row: number; col: number }[] = [];  // 收集坐标
        for (let row = 0; row < this._rows; row++) {
            for (let col = 0; col < this._cols; col++) {
                const cell = this._cells[row][col];
                // 条件：有图案 + 不是空白 + 不是消除中
                if (cell.iconType > 0 &&
                    cell.state !== CellState.EMPTY &&
                    cell.state !== CellState.REMOVING) {
                    iconTypes.push(cell.iconType);      // 记录图案
                    positions.push({ row, col });       // 记录位置
                }
            }
        }
        // ===== 第二步：打乱图案类型列表 =====
        this.shuffleArray(iconTypes);
        // ===== 第三步：把打乱后的图案重新填回原位置 =====
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            this._cells[pos.row][pos.col].iconType = iconTypes[i];
        }
        Logger.log(`BoardManager.shuffleRemainingIcons: 已重排 ${positions.length} 个图案`);
    }

        /**
     * 【新增】只重排已解锁格子的图案（锁定格子保持不动）
     * 用途：玩家使用"重排"道具时，只打乱可点击图案的分布
     */
    public shuffleUnlockedIcons(): void {
        // 收集已解锁格子的坐标和图案类型
        const positions: { row: number; col: number }[] = [];
        const iconTypes: number[] = [];

        for (let row = 0; row < this._rows; row++) {
            for (let col = 0; col < this._cols; col++) {
                const cell = this._cells[row][col];
                // 只收集解锁/选中状态的格子
                if (cell.iconType > 0 &&
                    (cell.state === CellState.UNLOCKED || cell.state === CellState.SELECTED)) {
                    positions.push({ row, col });
                    iconTypes.push(cell.iconType);
                }
            }
        }

        // 少于 2 个没有重排意义
        if (positions.length < 2) return;

        // 打乱图案类型
        this.shuffleArray(iconTypes);
        // 重新分配到原位置
        for (let i = 0; i < positions.length; i++) {
            this._cells[positions[i].row][positions[i].col].iconType = iconTypes[i];
        }

        Logger.log(`BoardManager.shuffleUnlockedIcons: 重排了 ${positions.length} 个已解锁图案`);
    }

    /**
     * 【新增】棋盘图案总对数（填满后 = 格子数 / 2）
     */
    public getTotalPairs(): number {
        return Math.floor((this._rows * this._cols) / 2);
    }
}