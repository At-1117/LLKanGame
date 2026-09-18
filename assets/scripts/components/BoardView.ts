import { _decorator, Component, Node, Prefab, instantiate, UITransform, Vec3, resources, SpriteFrame, Graphics, Color, tween } from 'cc';
import { BoardManager } from '../core/BoardManager';
import { Cell } from './Cell';
import { CellData, CellState } from '../data/CellData';
import { GameConfig } from '../data/GameConfig';
import { Logger } from '../utils/Logger';

const { ccclass, property } = _decorator;

    // ============================================================
    // assets/scripts/components/BoardView.ts
    // 棋盘视图组件
    // 挂载在场景中的 BoardLayer 节点上
    // 负责：根据 BoardManager 的数据创建和刷新格子节点
    // ============================================================
    @ccclass('BoardView')
    export class BoardView extends Component {

    // ==================== 编辑器暴露属性 ====================

    // Cell 预制体引用（在编辑器中拖拽赋值）
    @property({ type: Prefab, tooltip: '格子预制体（Cell.prefab）' })
    private cellPrefab: Prefab | null = null;

    @property({ type: SpriteFrame, tooltip: '占位图标（无预制体时使用）' })
    private placeholderIcon: SpriteFrame | null = null;

    // ==================== 私有属性 ====================

    // 棋盘数据管理器引用
    private _boardManager: BoardManager | null = null;

    // 格子节点二维数组，与棋盘数据一一对应
    // _cellNodes[row][col] → Node
        private _cellNodes: (Node | null)[][] = [];

    // ==================== 波浪落子入场动画（新增） ====================

    /** 入场动画：格子初始位置的 Y 偏移（在棋盘上方，落下起点） */
    private static readonly ENTRANCE_OFFSET_Y = 600;

    /** 入场动画：对角波浪每格延迟（秒），(row+col) 越大越晚落下 */
    private static readonly ENTRANCE_DELAY_PER_CELL = 0.04;

    /** 入场动画：单个格子落子动画时长（秒） */
    private static readonly ENTRANCE_DURATION = 0.35;

    /** 每个格子的目标位置（落子动画终点）：_cellTargets[row][col] → {x, y} */
    private _cellTargets: ({ x: number; y: number } | null)[][] = [];

    // ==================== 连接线相关（新增） ====================

    /** 当前棋盘使用的格子尺寸（布局时计算并保存，供连线坐标换算） */
    private _cellSize: number = GameConfig.CELL_SIZE;

    /** 棋盘布局的起始 X（第一列格子中心的 X 坐标） */
    private _startX: number = 0;

    /** 棋盘布局的起始 Y（第一行格子中心的 Y 坐标） */
    private _startY: number = 0;

    /** 连线节点（挂在 BoardLayer 下，渲染在所有格子之上） */
    private _lineNode: Node | null = null;

    /** 连线绘制组件 */
    private _graphics: Graphics | null = null;

    /** 【需求】点击棋盘空白处的回调（由 GameManager 注入，用于取消选中） */
    private _onBlankTapCallback: (() => void) | null = null;



    // 格子节点对象池（暂不实现，先直接创建/删除）
    // 后续优化时改为对象池复用

    // ==================== 生命周期方法 ====================

    onLoad(): void {
        // 【需求】监听棋盘空白区域点击（格子会阻止冒泡，只有空白处触发）
        this.node.on(Node.EventType.TOUCH_END, this.onBoardTouched, this);

        // 【新增】创建连线节点（用于绘制消除路径）
        this._lineNode = new Node('ConnectionLine');
        this._lineNode.setParent(this.node);
        // 挂 Graphics 组件用于画线
        this._graphics = this._lineNode.addComponent(Graphics);
    }

    onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_END, this.onBoardTouched, this);
    }

    /**
     * 【需求】点击棋盘空白处回调（GameManager 注入，用于取消选中）
     * @param callback 空白点击回调
     */
    public setBlankTapCallback(callback: () => void): void {
        this._onBlankTapCallback = callback;
    }

    /** 【需求】棋盘空白区域被点击 */
    private onBoardTouched(): void {
        this._onBlankTapCallback?.();
    }

    // ==================== 公开方法 ====================

    /**
     * 初始化棋盘视图
     * 根据 BoardManager 的数据创建所有格子节点
     * 
     * @param boardManager 棋盘数据管理器实例
     * @param onComplete 波浪落子入场动画全部落定后的回调（可选）
     */
    public init(boardManager: BoardManager, onComplete?: () => void): void {
        // 保存棋盘数据管理器引用
        this._boardManager = boardManager;

        // 获取棋盘尺寸
        const rows = boardManager.getRows();
        const cols = boardManager.getCols();

        // 初始化节点二维数组
        this._cellNodes = [];
        this._cellTargets = [];
        for (let row = 0; row < rows; row++) {
            this._cellNodes[row] = [];
            this._cellTargets[row] = [];
            for (let col = 0; col < cols; col++) {
                this._cellNodes[row][col] = null;
                this._cellTargets[row][col] = null;
            }
        }

        // 创建所有格子节点
        this.createAllCells();

        // 【新增】播放波浪落子入场动画（全部落定后回调）
        this.playEntranceAnimation(onComplete);

        Logger.log(`BoardView.init: 棋盘视图初始化完成，${rows}×${cols}`);
    }

    /**
     * 刷新单个格子的视图
     * 当格子数据状态改变时调用
     * 
     * @param row 行号
     * @param col 列号
     */
    public refreshCell(row: number, col: number): void {
        // 获取对应的节点
        const cellNode = this._cellNodes[row]?.[col];
        if (!cellNode) {
            Logger.warn(`BoardView.refreshCell: 找不到格子节点 (${row}, ${col})`);
            return;
        }

        // 获取节点上的 Cell 组件
        const cellComp = cellNode.getComponent(Cell);
        if (!cellComp) {
            Logger.warn(`BoardView.refreshCell: 节点上缺少 Cell 组件 (${row}, ${col})`);
            return;
        }

        // 调用 Cell 组件的刷新方法
        cellComp.refreshView();
    }

    /**
     * 获取指定位置的格子节点
     * @param row 行号
     * @param col 列号
     * @returns Node | null
     */
    public getCellNode(row: number, col: number): Node | null {
        if (row < 0 || row >= this._cellNodes.length) return null;
        if (col < 0 || col >= (this._cellNodes[row]?.length ?? 0)) return null;
        return this._cellNodes[row][col];
    }

    /**
     * 获取指定位置格子上的 Cell 组件
     * @param row 行号
     * @param col 列号
     * @returns Cell | null
     */
    public getCellComponent(row: number, col: number): Cell | null {
        const node = this.getCellNode(row, col);
        if (!node) return null;
        return node.getComponent(Cell);
    }

    public refreshAllCells(): void {
        for (let row = 0; row < this._cellNodes.length; row++) {
            for (let col = 0; col < this._cellNodes[row].length; col++) {
                // 获取节点
                const node = this._cellNodes[row][col];
                if (!node) continue; // 空节点跳过
                // 获取 Cell 组件
                const cellComp = node.getComponent(Cell);
                if (!cellComp) continue;
                // 刷新单个格子视图
                cellComp.refreshView();
            }
        }
    }

    /**
     * 【新增】棋盘波浪落子入场动画
     * 
     * 效果：所有格子初始位于棋盘上方（ENTRANCE_OFFSET_Y 偏移），
     * 按"对角波浪"顺序依次落到目标位置——延迟 = (row + col) × 每格延迟，
     * 即左上角的格子先落、右下角最后落，形成从左上到右下的涟漪效果。
     * 
     * @param onComplete 全部格子落定后的回调（可选）
     */
    public playEntranceAnimation(onComplete?: () => void): void {
        const rows = this._cellNodes.length;
        const cols = rows > 0 ? this._cellNodes[0].length : 0;

        let maxDelay = 0;
        let cellCount = 0;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const node = this._cellNodes[row][col];
                const target = this._cellTargets[row]?.[col];
                if (!node || !target) continue; // 空格子（EMPTY）没有节点，跳过
                cellCount++;

                // 对角波浪延迟：行 + 列越大越晚落下
                const delay = (row + col) * BoardView.ENTRANCE_DELAY_PER_CELL;
                maxDelay = Math.max(maxDelay, delay);

                // 从上方偏移位置弹性落到目标位置
                tween(node)
                    .delay(delay)
                    .to(BoardView.ENTRANCE_DURATION, { position: new Vec3(target.x, target.y, 0) }, { easing: 'backOut' })
                    .start();
            }
        }

        // 全部落定后回调（最晚一格延迟 + 动画时长 + 余量）
        if (cellCount > 0) {
            this.scheduleOnce(() => {
                onComplete?.();
            }, maxDelay + BoardView.ENTRANCE_DURATION + 0.05);
        } else {
            onComplete?.();
        }
    }

    // ==================== 私有方法 ====================

    /**
     * 【第三阶段新增】获取棋盘上所有格子的 Cell 组件列表
     * 
     * 用途：GameManager 用它给所有格子批量注入点击回调
     * 
     * @returns Cell 组件数组
     */
    public getAllCellComponents(): Cell[] {
        const result: Cell[] = [];
        // 遍历整个二维节点数组
        for (let row = 0; row < this._cellNodes.length; row++) {
            for (let col = 0; col < this._cellNodes[row].length; col++) {
                const node = this._cellNodes[row][col];
                if (!node) continue; // 空节点跳过
                // 尝试获取 Cell 组件
                const cellComp = node.getComponent(Cell);
                if (cellComp) {
                    result.push(cellComp);
                }
            }
        }
        return result;
    }

        // ==================== 连接线绘制（新增） ====================

    /**
     * 把棋盘坐标（行/列，包含外圈 -1 等）转换成 BoardLayer 本地坐标
     * @param row 行号（可为 -1 或 rows，表示棋盘外一圈）
     * @param col 列号（可为 -1 或 cols）
     */
    private cellToLocalPos(row: number, col: number): Vec3 {
        const gap = GameConfig.CELL_GAP;
        return new Vec3(
            this._startX + col * (this._cellSize + gap),   // X = 起始X + 列偏移
            this._startY - row * (this._cellSize + gap),   // Y = 起始Y - 行偏移
            0,
        );
    }

    /**
     * 【新增】绘制消除连接线（金黄折线，0.35 秒后自动消失）
     * @param path PathFinder 返回的路径坐标数组（含起点终点）
     */
    public drawConnection(path: { row: number; col: number }[]): void {
        // 安全检查
        if (!this._graphics || !this._lineNode) return;
        if (path.length < 2) return;

        // 确保连线节点渲染在所有格子之上（siblingIndex 最后）
        this._lineNode.setSiblingIndex(this.node.children.length - 1);

        // 清空旧线
        this._graphics.clear();

        // 线条样式：金黄半透明，6 像素宽
        this._graphics.lineWidth = 6;
        this._graphics.strokeColor = new Color(245, 197, 24, 220);

        // 起点：路径第一个点
        const firstPoint = this.cellToLocalPos(path[0].row, path[0].col);
        this._graphics.moveTo(firstPoint.x, firstPoint.y);

        // 依次连接路径上的每个拐点
        for (let i = 1; i < path.length; i++) {
            const point = this.cellToLocalPos(path[i].row, path[i].col);
            this._graphics.lineTo(point.x, point.y);
        }

        // 执行绘制
        this._graphics.stroke();

        // 0.35 秒后清除（消除动画约 0.3 秒，动画结束线也消失）
        this.scheduleOnce(() => {
            this._graphics?.clear();
        }, 0.35);
    }

    /**
     * 创建所有格子节点
     * 遍历棋盘数据，为每个有图案的格子创建一个节点
     */
    private createAllCells(): void {
        // 安全检查
        if (!this._boardManager) {
            Logger.error('BoardView.createAllCells: BoardManager 为空');
            return;
        }

        // 检查是否有预制体
        if (!this.cellPrefab) {
            // 如果没有预制体，尝试动态创建节点（用于测试阶段）
            Logger.warn('BoardView.createAllCells: 未设置 cellPrefab，将动态创建空节点');
            this.createCellsWithoutPrefab();
            return;
        }

        const rows = this._boardManager.getRows();
        const cols = this._boardManager.getCols();
        // 【第四阶段B 修改】格子尺寸改为按棋盘大小动态计算
        const cellSize = this.calcCellSize(rows, cols);
        const gap = GameConfig.CELL_GAP;

        // 计算棋盘总宽度和高度（用于居中）
        const totalWidth = cols * (cellSize + gap) - gap;
        const totalHeight = rows * (cellSize + gap) - gap;

        // 【需求】棋盘层点击区域覆盖整个棋盘（供"点击空白取消选中"）
        const layerUT = this.node.getComponent(UITransform);
        if (layerUT) {
            layerUT.setContentSize(totalWidth, totalHeight);
        }

        // 【新增】保存布局参数（连线坐标换算需要）
        this._cellSize = cellSize;
        this._startX = -totalWidth / 2 + cellSize / 2;
        this._startY = totalHeight / 2 - cellSize / 2;

        // 起始位置（左上角），使棋盘在 BoardLayer 中居中
        const startX = this._startX;
        const startY = this._startY;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // 获取该位置的格子数据
                const cellData = this._boardManager.getCell(row, col);
                if (!cellData) continue;

                // 只创建有图案的格子（iconType > 0）
                if (cellData.iconType <= 0) continue;

                // 使用预制体实例化一个新节点
                const cellNode = instantiate(this.cellPrefab);

                // 设置父节点为当前节点（BoardLayer）
                cellNode.setParent(this.node);

                // 设置节点名称（方便调试）
                cellNode.name = `Cell_${row}_${col}`;

                // 计算节点在棋盘中的位置
                const posX = startX + col * (cellSize + gap);
                const posY = startY - row * (cellSize + gap);
                // 【入场动画】记录目标位置，初始放到棋盘上方（落子起点）
                this._cellTargets[row][col] = { x: posX, y: posY };
                cellNode.setPosition(posX, posY + BoardView.ENTRANCE_OFFSET_Y, 0);

                // 获取 Cell 组件并初始化
                const cellComp = cellNode.getComponent(Cell);
                if (cellComp) {
                    cellComp.init(cellData, cellSize);
                }

                // 保存节点引用到二维数组
                this._cellNodes[row][col] = cellNode;
            }
        }
    }

    /**
     * 在没有预制体的情况下动态创建节点（临时方案）
     * 用于初期测试阶段，后续会被 createAllCells 替代
     */
    private createCellsWithoutPrefab(): void {
        if (!this._boardManager) return;

        const rows = this._boardManager.getRows();
        const cols = this._boardManager.getCols();
        const cellSize = this.calcCellSize(rows, cols);   // 改为动态计算
        const gap = GameConfig.CELL_GAP;

        // 计算棋盘总宽度和高度（用于居中）
        const totalWidth = cols * (cellSize + gap) - gap;
        const totalHeight = rows * (cellSize + gap) - gap;

        // 【需求】棋盘层点击区域覆盖整个棋盘（供"点击空白取消选中"）
        const layerUT = this.node.getComponent(UITransform);
        if (layerUT) {
            layerUT.setContentSize(totalWidth, totalHeight);
        }

        // 【新增】保存布局参数（连线坐标换算需要）
        this._cellSize = cellSize;
        this._startX = -totalWidth / 2 + cellSize / 2;
        this._startY = totalHeight / 2 - cellSize / 2;

        // 起始位置（左上角），使棋盘在 BoardLayer 中居中
        const startX = this._startX;
        const startY = this._startY;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const cellData = this._boardManager.getCell(row, col);
                if (!cellData || cellData.iconType <= 0) continue;

                // 动态创建一个空节点
                const cellNode = new Node(`Cell_${row}_${col}`);

                // 添加 UITransform 组件（节点必须有这个才能设置大小和位置）
                const uiTransform = cellNode.addComponent(UITransform);
                uiTransform.setContentSize(cellSize, cellSize);

                // 设置父节点
                cellNode.setParent(this.node);

                // 设置位置
                const posX = startX + col * (cellSize + gap);
                const posY = startY - row * (cellSize + gap);
                // 【入场动画】记录目标位置，初始放到棋盘上方（落子起点）
                this._cellTargets[row][col] = { x: posX, y: posY };
                cellNode.setPosition(posX, posY + BoardView.ENTRANCE_OFFSET_Y, 0);

                // 动态添加 Cell 组件
                const cellComp = cellNode.addComponent(Cell);
                cellComp.init(cellData, cellSize);

                // 保存引用
                this._cellNodes[row][col] = cellNode;
            }
        }
    }

    /**
     * 【第四阶段B 新增】根据棋盘大小计算适配屏幕的格子尺寸
     * 
     * 计算规则：
     *   取三个值的【最小值】作为格子尺寸：
     *   - 按可用宽度平分的尺寸（限制棋盘总宽 <= 700px）
     *   - 按可用高度平分的尺寸（限制棋盘总高 <= 850px）
     *   - GameConfig.CELL_SIZE（100px 上限，小棋盘不用放大）
     * 
     * 【需求】最终尺寸再扩大 110%（棋盘整体更大、图标更醒目）
     * 
     * @param rows 棋盘行数
     * @param cols 棋盘列数
     * @returns 格子边长（像素）
     */
    private calcCellSize(rows: number, cols: number): number {
        const gap = GameConfig.CELL_GAP;

        // 棋盘可用的最大宽度和高度（给屏幕边距留空间）
        const MAX_BOARD_WIDTH = 650;
        const MAX_BOARD_HEIGHT = 900;

        // 按宽度平分的格子尺寸：(总宽 + gap) / cols - gap
        const sizeByWidth = (MAX_BOARD_WIDTH + gap) / cols - gap;
        // 按高度平分的格子尺寸
        const sizeByHeight = (MAX_BOARD_HEIGHT + gap) / rows - gap;

        // 取三者最小值（不超过上限 100）
        const finalSize = Math.min(sizeByWidth, sizeByHeight, GameConfig.CELL_SIZE);

        // 最小不低于 40px（防止极端棋盘小到看不见）
        return Math.max(finalSize, 40);
    }
}