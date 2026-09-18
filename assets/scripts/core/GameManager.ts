// ============================================================
// assets/scripts/core/GameManager.ts   【完整新版·第六阶段】
// 游戏主控制器
// 本版改动：
//   1. 直入关卡：从存档读取当前进行中的关卡
//   2. 步数系统：替代计分，每消除一对消耗 1 步
//   3. 失败判定：步数用完且未通关 → 扣 1 心 → 失败弹窗
//   4. 图案不同点击 → 震动 + 抖动 + 取消选中
//   5. 通关：按剩余步数评星、存档、弹窗
//   6. 设置面板接入（返回首页/重新开始）
// ============================================================

import { _decorator, Component, director, SpriteFrame, Node, UITransform, Color, Label } from 'cc';
import { BoardManager } from './BoardManager';
import { PathFinder } from './PathFinder';
import { MatchChecker } from './MatchChecker';
import { BoardView } from '../components/BoardView';
import { StepSystem } from '../systems/StepSystem';
import { PropSystem } from '../systems/PropSystem';
import { LevelManager } from '../systems/LevelManager';
import { SaveSystem } from '../systems/SaveSystem';
import { HeartSystem } from '../systems/HeartSystem';
import { VibrationManager } from '../systems/VibrationManager';
import { IconManager } from '../systems/IconManager';
import { AudioSystem } from '../systems/AudioSystem';
import { GameHUD } from '../ui/GameHUD';
import { ResultDialog } from '../ui/ResultDialog';
import { SettingsDialog } from '../ui/SettingsDialog';
import { LevelConfig } from '../data/LevelData';
import { CellData, CellState } from '../data/CellData';
import { GameConfig } from '../data/GameConfig';
import { Logger } from '../utils/Logger';
import { GlobalData } from '../data/GlobalData';

const { ccclass, property } = _decorator;

export enum GameState {
    IDLE,
    PLAYING,
    ANIMATING,
    PAUSED,
    GAME_OVER,
}

@ccclass('GameManager')
export class GameManager extends Component {

    // ==================== 编辑器暴露属性 ====================

    @property({ type: BoardView, tooltip: '棋盘视图组件' })
    private boardView: BoardView | null = null;

    @property({ type: GameHUD, tooltip: 'HUD 组件' })
    private hud: GameHUD | null = null;

    @property({ type: ResultDialog, tooltip: '结算弹窗组件' })
    private resultDialog: ResultDialog | null = null;

    @property({ type: SettingsDialog, tooltip: '设置弹窗组件' })
    private settingsDialog: SettingsDialog | null = null;

    @property({ type: [SpriteFrame], tooltip: '图案贴图列表（下标0=iconType1）' })
    private iconFrames: SpriteFrame[] = [];

    // ==================== 私有属性 ====================

    private _boardManager: BoardManager | null = null;
    private _stepSystem: StepSystem = new StepSystem();
    private _propSystem: PropSystem = new PropSystem();
    private _gameState: GameState = GameState.IDLE;
    private _currentLevel: LevelConfig | null = null;
    private _selectedCell: { row: number; col: number } | null = null;
    private _hintPair: { row1: number; col1: number; row2: number; col2: number } | null = null;

    /** 【技能】临时解锁的格子列表（5秒后恢复锁定用） */
    private _tempUnlockedCells: CellData[] = [];

    /** 【技能】已被扩散永久解锁的格子（技能恢复时跳过它们） */
    private _permanentUnlocked: Set<CellData> = new Set();

    /** 【UX】临时提示 Label（道具用完等提示，动态创建） */
    private _toastLabel: Label | null = null;
    // ==================== 生命周期 ====================

    onLoad(): void {
        // 【诊断】确认 Game 场景组件已加载
        Logger.log('GameManager.onLoad: 组件已加载');

        this._boardManager = new BoardManager();
        this._propSystem.init();

        // 注入 HUD 道具点击回调
        this.hud?.setPropClickHandler((propId: string) => this.useProp(propId));
    
        // 【技能】HUD 的"解锁"技能按钮回调
        this.hud?.setSkillClickHandler(() => this.useUnlockSkill());

        // HUD 的"设置"按钮 → 打开设置面板
        this.hud?.setBackClickHandler(() => {
            Logger.log('GameManager: 设置回调触发，尝试打开设置面板');
            if (this.settingsDialog) {
                this.settingsDialog.show();
            } else {
                Logger.warn('GameManager: settingsDialog 属性未绑定！');
            }
        });
        
        // 结算弹窗回调
        this.resultDialog?.setCallbacks(
            () => this.nextLevel(),
            () => this.replayLevel(),
            () => this.backToHome(),
        );
        // 设置弹窗回调
        this.settingsDialog?.setCallbacks(
            () => this.backToHome(),
            () => this.replayLevel(),
        );

        // 【新增】给游戏内所有按钮绑定统一音效
        AudioSystem.bindButtonSounds(this.node);
    }

    async start(): Promise<void> {
        // 【诊断】确认 start 执行
        Logger.log('GameManager.start: 游戏启动');

        // 【修复】确保弹窗层组件（ResultDialog/SettingsDialog）的 onLoad 已执行完毕。
        // Cocos 3.x 中 inactive 节点的 onLoad 会延迟到首次激活才执行：
        // 若 PopupLayer 在场景里被设为 inactive，通关激活弹窗的瞬间 onLoad 的
        // "初始隐藏"逻辑会把刚激活的层又关掉（表现为弹窗不显示，需点设置才恢复）。
        this.ensurePopupLayerInitialized();

        // 【根治】进入游戏场景立即清场，杜绝跨场景音效残留
        AudioSystem.stopAllClickSounds();

        // 加载关卡配置
        try {
            await LevelManager.loadLevels();
        } catch (err) {
            Logger.error('GameManager.start: 关卡配置加载失败', err);
        }

        // ===== 读取本次要玩的关卡 =====
        // 优先用 GlobalData（Menu 点开始 / 弹窗点下一关时写入），
        // 为 0 时（直接预览 Game 场景）退回读存档
        const levelId = GlobalData.currentLevelId > 0
            ? GlobalData.currentLevelId
            : SaveSystem.load().currentLevel;

        // ===== 获取或生成该关的棋盘种子 =====
        // 同一关：重玩/重进都用同一份种子 → 布局一致不重排
        let seed = SaveSystem.getLevelSeed(levelId);
        if (!seed) {
            seed = Math.floor(Math.random() * 1000000) + 1;
            SaveSystem.setLevelSeed(levelId, seed);
        }

        const config = LevelManager.getLevel(levelId);
        if (!config) {
            // 找不到（如通关了最后一关）→ 用最后一关或默认关
            Logger.warn(`GameManager.start: 找不到第${levelId}关，使用默认关卡`);
            this.startLevel(this.getDefaultLevelConfig(), seed);
            return;
        }

        // ===== 注册图案 + 预加载音效 =====
        IconManager.registerIcons(this.iconFrames);

        const iconTypes: number[] = [];
        for (let t = 1; t <= config.iconTypes; t++) iconTypes.push(t);
        await AudioSystem.preloadSounds(iconTypes);
        // 【修复②】进入游戏时强制按当前设置同步 BGM 状态
        // 防止场景切换过程中的残留播放：设置是关就立即停止
        // 【需求】进入 Game 界面后背景音乐音量自动调小至 50%
        AudioSystem.setBgmVolume(0.5);
        AudioSystem.refreshBgm();
        this.startLevel(config, seed);
    }

    // ==================== 关卡开始 ====================

    /**
     * 【修复】强制初始化弹窗层
     * 
     * 背景：Cocos Creator 3.x 中，节点 inactive 时其组件 onLoad 会延迟到
     * 首次激活才执行。若 PopupLayer 或其子面板在场景里被设为 inactive，
     * ResultDialog / SettingsDialog 的 onLoad（内含"初始隐藏"逻辑）不会在
     * 场景加载时执行，而是推迟到弹窗首次激活的瞬间——此时 onLoad 会把刚
     * 激活的层再次关闭，导致结算/设置弹窗不显示；且 PopupLayer 保持激活时
     * 全屏遮罩（Mask）会常显，游戏界面变暗。
     * 
     * 本方法在进入游戏时统一处理：确保 onLoad 已执行、面板隐藏、弹窗层隐藏。
     */
    private ensurePopupLayerInitialized(): void {
        const popupLayer = this.resultDialog?.node.parent ?? this.settingsDialog?.node.parent;
        if (!popupLayer) return;

        // PopupLayer 不在层级中 → 先激活，强制触发 ResultDialog / SettingsDialog 的 onLoad
        if (!popupLayer.activeInHierarchy) {
            popupLayer.active = true;
        }

        // onLoad 的隐藏逻辑已生效，显式恢复隐藏初始态
        if (this.resultDialog) this.resultDialog.node.active = false;
        if (this.settingsDialog) this.settingsDialog.node.active = false;
        // 强制隐藏弹窗层（防止 Mask 遮罩常显导致界面变暗）
        popupLayer.active = false;
        Logger.log('GameManager.ensurePopupLayerInitialized: 已强制初始化弹窗层（onLoad 提前执行 + 层已隐藏）');
    }

    public startLevel(config: LevelConfig, seed?: number): void {
        this._currentLevel = config;

        // ===== 初始化步数系统 =====
        // 最少步数 = 图案总对数（棋盘填满后 = 格子数 / 2）
        const minSteps = Math.floor((config.rows * config.cols) / 2);
        // 奖励步数 x 由难度决定
        const bonus = GameConfig.DIFFICULTY_BONUS[config.difficulty ?? 'normal'] ?? 10;
        this._stepSystem.init(minSteps, bonus);

        // ===== 重置道具 =====
        this._propSystem.init();

        // ===== 初始化棋盘 =====
        if (this._boardManager) this._boardManager.initBoard(config, seed);
        if (this.boardView && this._boardManager) {
            // 【入场动画】波浪落子期间禁止操作，全部落定后再进入 PLAYING
            this._gameState = GameState.ANIMATING;
            this.boardView.init(this._boardManager, () => this.onBoardReady());
        } else {
            this.onBoardReady();
        }

        // ===== 注入格子点击回调 =====
        if (this.boardView) {
            for (const cell of this.boardView.getAllCellComponents()) {
                cell.setClickCallback((row: number, col: number) => this.onCellClicked(row, col));
            }
            // 【需求】点击棋盘空白处取消选中
            this.boardView.setBlankTapCallback(() => this.onBoardBlankTouched());
        }

        this._selectedCell = null;
        this._hintPair = null;
        
        // 【技能】清空技能运行时状态（次数由存档持久化，不重置）
        this._tempUnlockedCells = [];
        this._permanentUnlocked.clear();
        // 刷新技能按钮数量显示（跨关剩余）
        this.hud?.updatePropCount(GameConfig.PROP_SKILL, this._propSystem.getCount(GameConfig.PROP_SKILL));

        // ===== 初始化 HUD =====
        this.hud?.updateSteps(this._stepSystem.getRemaining(), this._stepSystem.getTotal());
        this.hud?.updatePropCount(GameConfig.PROP_HINT, this._propSystem.getCount(GameConfig.PROP_HINT));
        this.hud?.updatePropCount(GameConfig.PROP_SHUFFLE, this._propSystem.getCount(GameConfig.PROP_SHUFFLE));
        this.hud?.updatePropCount(GameConfig.PROP_BOMB, this._propSystem.getCount(GameConfig.PROP_BOMB));
        // 【新增】显示关卡名和难度
        this.hud?.updateLevel(config.levelId, config.difficulty ?? 'normal');
    }

    /**
     * 【新增】棋盘就绪回调（波浪落子入场动画全部落定后调用）
     * 执行开局可解性验证（无解自动重排兜底），然后进入 PLAYING 状态
     */
    private onBoardReady(): void {
        // ===== 开局可解性验证（无解时自动重排兜底） =====
        if (this._boardManager && MatchChecker.isStuck(this._boardManager)) {
            Logger.warn('GameManager.startLevel: 初始棋盘无解，尝试自动重排兜底');
            if (!this.ensureSolvable()) {
                Logger.error('GameManager.startLevel: 自动重排后仍无解！请检查 initialUnlocked 配置');
            }
        }

        this._gameState = GameState.PLAYING;
        Logger.log(`GameManager.startLevel: 第${this._currentLevel?.levelId ?? 0}关开始，` +
            `难度=${this._currentLevel?.difficulty ?? 'normal'}，初始步数=${this._stepSystem.getTotal()}`);
    }

    // ==================== 玩家点击 ====================

    public onCellClicked(row: number, col: number): void {
        if (this._gameState !== GameState.PLAYING) return;

        const cellData = this._boardManager?.getCell(row, col);
        if (!cellData) return;

        if (cellData.state !== CellState.UNLOCKED && cellData.state !== CellState.SELECTED) return;

        // 点击音效
        AudioSystem.playClickSound(cellData.iconType);

        // 点击已选中的格子 → 取消选中
        if (this._selectedCell && this._selectedCell.row === row && this._selectedCell.col === col) {
            this.deselectCell();
            return;
        }

        // 第一次选中
        if (this._selectedCell === null) {
            this.selectCell(row, col);
            return;
        }

        // 第二次选中 → 尝试配对
        const firstRow = this._selectedCell.row;
        const firstCol = this._selectedCell.col;

        // 【需求】后选中的格子也显示选中高亮（再尝试配对）
        const secondCell = this._boardManager?.getCell(row, col);
        if (secondCell && secondCell.state === CellState.UNLOCKED) {
            secondCell.state = CellState.SELECTED;
            this.boardView?.refreshCell(row, col);
        }

        this.tryMatch(firstRow, firstCol, row, col);
    }

    /**
     * 【需求】点击棋盘空白处取消选中
     */
    private onBoardBlankTouched(): void {
        if (this._gameState === GameState.PLAYING && this._selectedCell) {
            this.deselectCell();
        }
    }

    private selectCell(row: number, col: number): void {
        this._selectedCell = { row, col };

        const cellData = this._boardManager?.getCell(row, col);
        if (cellData) cellData.state = CellState.SELECTED;

        this.boardView?.getCellComponent(row, col)?.stopHintAnimation();
        // 【需求】选中后清除提示高亮边框（避免与选中红框叠加）
        this.boardView?.getCellComponent(row, col)?.stopHintHighlight();
        // 【需求】选中格子时播放弹跳提示动画
        this.boardView?.getCellComponent(row, col)?.playSelectAnimation();
        this.boardView?.refreshCell(row, col);
    }

    private deselectCell(): void {
        if (!this._selectedCell) return;

        const { row, col } = this._selectedCell;
        const cellData = this._boardManager?.getCell(row, col);
        if (cellData && cellData.state === CellState.SELECTED) {
            cellData.state = CellState.UNLOCKED;
        }
        this.boardView?.refreshCell(row, col);
        this._selectedCell = null;
    }

    /**
     * 【需求】配对失败时恢复后选中格子的高亮（SELECTED → UNLOCKED）
     * @param row 后选中格子的行号
     * @param col 后选中格子的列号
     */
    private restoreSecondSelection(row: number, col: number): void {
        const cell = this._boardManager?.getCell(row, col);
        if (cell && cell.state === CellState.SELECTED) {
            cell.state = CellState.UNLOCKED;
            this.boardView?.refreshCell(row, col);
        }
    }

    // ==================== 配对与消除 ====================

        /**
     * 配对尝试
     * 图案不同 → 震动 + 抖动 + 取消选中 + 扣 1 步
     * 图案相同但不连通 → 取消选中 + 扣 1 步
     */
    private tryMatch(row1: number, col1: number, row2: number, col2: number): void {
        const cell1 = this._boardManager?.getCell(row1, col1);
        const cell2 = this._boardManager?.getCell(row2, col2);
        if (!cell1 || !cell2 || !this._boardManager) return;

        // ===== 图案不同：震动报错 =====
        if (cell1.iconType !== cell2.iconType) {
            // 手机震动（受开关控制）
            VibrationManager.vibrate();
            // 两个格子视觉抖动
            this.boardView?.getCellComponent(row1, col1)?.playShakeAnimation();
            this.boardView?.getCellComponent(row2, col2)?.playShakeAnimation();
            // 取消选中
            this.deselectCell();
            // 【需求】恢复后选中格子的高亮
            this.restoreSecondSelection(row2, col2);
            // 【修改】点错也扣 1 步
            this.consumeStepForFailedMatch();
            return;
        }

        // ===== 图案相同：检查连通 =====
        const path = PathFinder.findPath(this._boardManager, row1, col1, row2, col2);
        if (!path) {
            // 【新增】相同但不连通：震动 + 两个格子抖动
            VibrationManager.vibrate();
            this.boardView?.getCellComponent(row1, col1)?.playShakeAnimation();
            this.boardView?.getCellComponent(row2, col2)?.playShakeAnimation();
            // 取消选中
            this.deselectCell();
            // 【需求】恢复后选中格子的高亮
            this.restoreSecondSelection(row2, col2);
            // 扣 1 步
            this.consumeStepForFailedMatch();
            return;
        }

        // 【新增】连通成功：绘制连接线特效
        this.boardView?.drawConnection(path);

        // 消除成功
        this.onMatchSuccess(row1, col1, row2, col2);
    }

    /**
     * 【新增】匹配失败时消耗步数并检查是否步数用完
     * 点错两个图案（不同或不连通）都算一次失误，扣 1 步
     */
    private consumeStepForFailedMatch(): void {
        // 消耗 1 步
        this._stepSystem.consumeStep();
        // 刷新 HUD 步数显示
        this.hud?.updateSteps(this._stepSystem.getRemaining(), this._stepSystem.getTotal());

        Logger.log(`GameManager.consumeStepForFailedMatch: 匹配失败扣1步，剩余 ${this._stepSystem.getRemaining()}`);

        // 步数用完且棋盘未通关 → 直接失败
        if (this._stepSystem.isOutOfSteps() && !this._boardManager?.isAllCleared()) {
            this.onFail();
        }
    }

        private onMatchSuccess(
        row1: number, col1: number,
        row2: number, col2: number,
        fromBomb: boolean = false,   // 【需求】炸弹消除不消耗步数
    ): void {
        this._gameState = GameState.ANIMATING;

        // 【新增】消除成功震动（手动消除和炸弹都震）
        VibrationManager.vibrate();

        // 【需求】取消消除音效，改为"暂停并重新播放选中格子的音效"
        // （playClickSound 内部先停止所有点击音源再播放，即先暂停后重播）
        const matchedIcon = this._boardManager?.getCell(row1, col1)?.iconType ?? 0;
        if (matchedIcon > 0) {
            AudioSystem.playClickSound(matchedIcon);
        }

        // ===== 消耗 1 步（【需求】炸弹消除不消耗步数） =====
        if (!fromBomb) {
            this._stepSystem.consumeStep();
        }
        this.hud?.updateSteps(this._stepSystem.getRemaining(), this._stepSystem.getTotal());

        // 清除提示高亮
        this.clearHintAnimation();

        this._selectedCell = null;

        const cell1 = this._boardManager?.getCell(row1, col1);
        if (cell1) cell1.state = CellState.REMOVING;
        const cell2 = this._boardManager?.getCell(row2, col2);
        if (cell2) cell2.state = CellState.REMOVING;

        this.boardView?.refreshCell(row1, col1);
        this.boardView?.refreshCell(row2, col2);

        // 等待两个消除动画完成（带超时兜底：回调丢失时强制继续，防止永久卡在 ANIMATING）
        let pendingRemoves = 2;
        let settled = false;
        const finishRemoval = () => {
            if (settled) return;
            settled = true;
            this.unschedule(timeoutFallback);
            this.onBothRemoved(row1, col1, row2, col2);
        };
        const onOneRemoved = () => {
            pendingRemoves--;
            if (pendingRemoves <= 0) finishRemoval();
        };
        const timeoutFallback = () => {
            Logger.warn('GameManager.onMatchSuccess: 消除动画回调超时（1.5s），强制继续流程');
            finishRemoval();
        };
        this.scheduleOnce(timeoutFallback, 1.5);
        this.boardView?.getCellComponent(row1, col1)?.setRemovedCallback(onOneRemoved);
        this.boardView?.getCellComponent(row2, col2)?.setRemovedCallback(onOneRemoved);
    }

    /**
     * 【第六阶段修改】消除动画完成后的流程
     * 顺序：解锁扩散 → 通关检查 → 步数用完(失败)检查 → 卡死检查
     */
    private onBothRemoved(row1: number, col1: number, row2: number, col2: number): void {
        // ===== 解锁扩散 =====
        const unlocked1 = this._boardManager?.unlockAround(row1, col1) ?? [];
        const unlocked2 = this._boardManager?.unlockAround(row2, col2) ?? [];
        const uniqueUnlocked = this.deduplicateUnlocked(unlocked1, unlocked2);

        for (const cell of uniqueUnlocked) {
            // 【技能】记录到"永久解锁"集合（技能恢复锁定时跳过这些格子）
            this._permanentUnlocked.add(cell);
            this.boardView?.refreshCell(cell.row, cell.col);
            this.boardView?.getCellComponent(cell.row, cell.col)?.playUnlockAnimation();
        }

        // ===== 检查1：通关 =====
        if (this._boardManager?.isAllCleared()) {
            this.onLevelComplete();
            return;
        }

        // ===== 检查2：步数用完 → 失败 =====
        if (this._stepSystem.isOutOfSteps()) {
            this.onFail();
            return;
        }

        // ===== 检查3：无可消除对 → 判定失败 =====
        // 【规则修改】取消自动重排，棋盘无解直接失败（扣心）
        if (this._boardManager && MatchChecker.isStuck(this._boardManager)) {
            Logger.warn('GameManager.onBothRemoved: 场上没有可相连的图案，判定失败');
            this.onFail();
            return;
        }

        this._gameState = GameState.PLAYING;
    }

    // ==================== 通关与失败 ====================

    private onLevelComplete(): void {
        this._gameState = GameState.GAME_OVER;

        const levelId = this._currentLevel?.levelId ?? 1;
        const stepsLeft = this._stepSystem.getRemaining();
        const stars = this._stepSystem.calcStars();

        // 存档：星级 + 推进关卡
        SaveSystem.updateLevelStars(levelId, stars);
        if (!LevelManager.isLastLevel(levelId)) {
            SaveSystem.unlockNextLevel(levelId);
        }

        const hasNext = !LevelManager.isLastLevel(levelId);
        // 【需求】通关时播放胜利音效（不受音效开关控制）
        AudioSystem.playVictorySound();
        // 【修复】延迟到下一帧再显示结算弹窗：
        // onLevelComplete 可能由 Cell 消除动画的 tween 回调链触发（onBothRemoved），
        // 且 ResultDialog 所在 PopupLayer 处于 inactive（其自身 scheduleOnce 不可靠，
        // 会导致激活父节点不生效、弹窗不显示——表现为"通关后要点设置再关闭才出现"）。
        // 改用 GameManager（挂在 Canvas 上，始终激活）调度，保证弹窗激活必然生效。
        this.scheduleOnce(() => {
            this.resultDialog?.showSuccess(stepsLeft, stars, hasNext);
        }, 0.05);

        Logger.log(`🎉 通关！第${levelId}关 | 剩余${stepsLeft}步 | ${stars}星`);
    }

    /**
     * 【第六阶段新增】游戏失败：步数用完且未通关
     * 扣 1 颗心，显示失败弹窗
     */
    private onFail(): void {
        this._gameState = GameState.GAME_OVER;

        // 扣心
        const heartsLeft = HeartSystem.loseHeart();

        // 【需求】失败时播放失败音效（不受音效开关控制）
        AudioSystem.playFailSound();

        // 【修复】同 onLevelComplete：onFail 也可能由 tween 回调链触发，
        // 用 GameManager 的调度显示失败弹窗，保证激活生效
        this.scheduleOnce(() => {
            this.resultDialog?.showFail(heartsLeft);
        }, 0.05);

        Logger.log(`💔 失败！步数用完，扣 1 心，剩余 ${heartsLeft} 心`);
    }

    // ==================== 卡死重排 ====================

        /**
     * 【修改】确保棋盘有解（两级策略）
     * 第一步：只重排已解锁图案（锁定图案不动）——玩家感受更好
     * 第二步：仍无解时兜底全量重排
     */
    private ensureSolvable(): boolean {
        if (!this._boardManager) return false;

        // ===== 第一步：只重排已解锁图案 =====
        for (let attempt = 1; attempt <= 10; attempt++) {
            this._boardManager.shuffleUnlockedIcons();
            this.boardView?.refreshAllCells();
            if (!MatchChecker.isStuck(this._boardManager)) {
                Logger.log(`GameManager.ensureSolvable: 已解锁图案重排成功（第 ${attempt} 次尝试）`);
                return true;
            }
        }

        // ===== 第二步：兜底全量重排 =====
        for (let attempt = 1; attempt <= 10; attempt++) {
            this._boardManager.shuffleRemainingIcons();
            this.boardView?.refreshAllCells();
            if (!MatchChecker.isStuck(this._boardManager)) {
                Logger.log(`GameManager.ensureSolvable: 全量重排成功（第 ${attempt} 次尝试）`);
                return true;
            }
        }

        Logger.error('GameManager.ensureSolvable: 重排后仍无解');
        return false;
    }

    // ==================== 道具 ====================

    public useProp(propId: string): void {
        if (this._gameState !== GameState.PLAYING) {
            Logger.log(`GameManager.useProp: 当前状态 ${this._gameState}，不能使用道具`);
            return;
        }
        if (!this._propSystem.hasProp(propId)) {
            // 【需求】取消"道具已用完"提示（按钮仍可点击，为后续"看广告获取"留入口）
            Logger.warn(`GameManager.useProp: 道具 ${propId} 数量不足`);
            return;
        }

        switch (propId) {
            case GameConfig.PROP_HINT:
                this.useHintProp();
                break;
            case GameConfig.PROP_SHUFFLE:
                this.useShuffleProp();
                break;
            case GameConfig.PROP_BOMB:
                this.useBombProp();
                break;
            case GameConfig.PROP_SKILL:
                this.useUnlockSkill();
                break;
            default:
                Logger.warn(`GameManager.useProp: 未知道具ID ${propId}`);
                break;
        }
    }

    private useHintProp(): void {
        const match = MatchChecker.findOneMatch(this._boardManager!);
        if (!match) {
            Logger.warn('GameManager.useHintProp: 当前没有可消除对');
            return;
        }

        this._propSystem.consume(GameConfig.PROP_HINT);
        this.hud?.updatePropCount(GameConfig.PROP_HINT, this._propSystem.getCount(GameConfig.PROP_HINT));

        this.clearHintAnimation();
        this._hintPair = { row1: match.row1, col1: match.col1, row2: match.row2, col2: match.col2 };
        this.boardView?.getCellComponent(match.row1, match.col1)?.playHintAnimation();
        this.boardView?.getCellComponent(match.row2, match.col2)?.playHintAnimation();
        // 【需求】提示格子加金色高亮边框
        this.boardView?.getCellComponent(match.row1, match.col1)?.playHintHighlight();
        this.boardView?.getCellComponent(match.row2, match.col2)?.playHintHighlight();
    }

    private useShuffleProp(): void {
        this.deselectCell();

        this._propSystem.consume(GameConfig.PROP_SHUFFLE);
        this.hud?.updatePropCount(GameConfig.PROP_SHUFFLE, this._propSystem.getCount(GameConfig.PROP_SHUFFLE));

        this.ensureSolvable();
    }

    private useBombProp(): void {
        const match = MatchChecker.findOneMatch(this._boardManager!);
        if (!match) {
            Logger.warn('GameManager.useBombProp: 当前没有可消除对');
            return;
        }

        this._propSystem.consume(GameConfig.PROP_BOMB);
        this.hud?.updatePropCount(GameConfig.PROP_BOMB, this._propSystem.getCount(GameConfig.PROP_BOMB));

        // 【新增】炸弹消除也画连接线
        const bombPath = PathFinder.findPath(
            this._boardManager!,
            match.row1, match.col1,
            match.row2, match.col2,
        );
        if (bombPath) {
            this.boardView?.drawConnection(bombPath);
        }

        // 【需求】炸弹消除不消耗步数（fromBomb=true）
        this.onMatchSuccess(match.row1, match.col1, match.row2, match.col2, true);
    }

        /**
     * 【技能】使用"解锁"技能
     * 效果：所有锁定图案立即变为可点击，持续 5 秒后恢复锁定
     * 规则：每关限用 1 次
     */
        private useUnlockSkill(): void {
            // 状态检查：只有游戏中可用
            if (this._gameState !== GameState.PLAYING) {
                Logger.log(`GameManager.useUnlockSkill: 当前状态 ${this._gameState}，不能使用技能`);
                return;
            }

            if (!this._boardManager) return;

            // ===== 次数检查（跨关持久化的次数制） =====
            if (!this._propSystem.hasProp(GameConfig.PROP_SKILL)) {
                Logger.warn('GameManager.useUnlockSkill: 解锁技能次数不足');
                return;
            }

            // 消耗一次并保存存档
            this._propSystem.consume(GameConfig.PROP_SKILL);
            // 刷新 HUD 数量显示
            this.hud?.updatePropCount(GameConfig.PROP_SKILL, this._propSystem.getCount(GameConfig.PROP_SKILL));

            // ===== 收集所有锁定格子并临时解锁 =====
            this._tempUnlockedCells = [];
            const cells = this._boardManager.getAllCells();
            for (let row = 0; row < cells.length; row++) {
                for (let col = 0; col < cells[row].length; col++) {
                    const cell = cells[row][col];
                    if (cell.state === CellState.LOCKED) {
                        cell.state = CellState.UNLOCKED;
                        this._tempUnlockedCells.push(cell);
                    }
                }
        }

        // 刷新全部格子视图（锁定格子变亮）
        this.boardView?.refreshAllCells();

        Logger.log(`GameManager.useUnlockSkill: 临时解锁 ${this._tempUnlockedCells.length} 个图案，持续 ${GameConfig.SKILL_UNLOCK_DURATION} 秒`);

        // ===== 5 秒后恢复锁定 =====
        this.scheduleOnce(() => {
            for (const cell of this._tempUnlockedCells) {
                // 恢复条件：
                //   1. 被扩散永久解锁的 → 跳过（保持解锁）
                //   2. 被消除的（EMPTY）→ 跳过
                //   3. 其余 UNLOCKED / SELECTED → 恢复 LOCKED
                if (this._permanentUnlocked.has(cell)) continue;
                if (cell.state === CellState.UNLOCKED || cell.state === CellState.SELECTED) {
                    cell.state = CellState.LOCKED;
                }
            }

            // 清空列表
            this._tempUnlockedCells = [];

            // 如果选中的格子被锁回去了，清空选中
            this._selectedCell = null;

            // 刷新视图
            this.boardView?.refreshAllCells();

            Logger.log('GameManager.useUnlockSkill: 技能结束，图案恢复锁定');
        }, GameConfig.SKILL_UNLOCK_DURATION);
    }

    private clearHintAnimation(): void {
        if (!this._hintPair) return;
        const { row1, col1, row2, col2 } = this._hintPair;
        this.boardView?.getCellComponent(row1, col1)?.stopHintAnimation();
        this.boardView?.getCellComponent(row2, col2)?.stopHintAnimation();
        // 【需求】同步清除提示高亮边框
        this.boardView?.getCellComponent(row1, col1)?.stopHintHighlight();
        this.boardView?.getCellComponent(row2, col2)?.stopHintHighlight();
        this._hintPair = null;
    }

    // ==================== 临时提示（Toast） ====================

    /**
     * 【UX】显示一条临时提示（屏幕中下方，2 秒后自动隐藏）
     * 首次调用时动态创建 Label 节点，无需改场景
     * @param text 提示文字
     */
    private showToast(text: string): void {
        if (!this._toastLabel) {
            const node = new Node('ToastLabel');
            node.setParent(this.node);
            const uiTransform = node.addComponent(UITransform);
            uiTransform.setContentSize(600, 60);
            const label = node.addComponent(Label);
            label.fontSize = 32;
            label.lineHeight = 44;
            label.color = new Color(255, 230, 120, 255);
            node.setPosition(0, -300, 0);
            this._toastLabel = label;
        }
        this._toastLabel.string = text;
        this._toastLabel.node.active = true;
        this.unschedule(this.hideToast);
        this.scheduleOnce(this.hideToast, 2);
    }

    /** 隐藏提示 */
    private hideToast(): void {
        if (this._toastLabel) {
            this._toastLabel.node.active = false;
        }
    }

    private deduplicateUnlocked(list1: CellData[], list2: CellData[]): CellData[] {
        const map = new Map<string, CellData>();
        for (const cell of list1) map.set(`${cell.row},${cell.col}`, cell);
        for (const cell of list2) {
            const key = `${cell.row},${cell.col}`;
            if (!map.has(key)) map.set(key, cell);
        }
        return Array.from(map.values());
    }

    // ==================== 弹窗按钮 ====================

    /** 【修复】场景切换防重复标记 */
    private _sceneSwitching = false;

    /**
     * 【修复】延迟切换场景：先播放按钮音效（btn.mp3 约 0.5s，场景切换会 stop 音效，
     * 直接切会导致按钮无声/音效被截断）
     * @param sceneName 目标场景名
     */
    private switchScene(sceneName: string): void {
        if (this._sceneSwitching) return;
        this._sceneSwitching = true;
        this.scheduleOnce(() => {
            this._sceneSwitching = false;
            // 【修复】延迟清理：先让按钮音效（btn.mp3 约 0.5s）播完，再停残留音效并切场景
            AudioSystem.stopAllClickSounds();
            director.loadScene(sceneName);
        }, 0.5);
    }

    /**
     * 下一关：关卡ID+1 写入 GlobalData，重载场景
     */
    public nextLevel(): void {
        AudioSystem.stopResultSound();   // 【需求】停止胜利音效（场景切换后 refreshBgm 恢复 BGM）
        GlobalData.currentLevelId = (this._currentLevel?.levelId ?? 1) + 1;
        this.switchScene('Game');
    }

    /** 重玩/重试：重载 Game 场景（currentLevel 不变，重新开始本关） */
    public replayLevel(): void {
        AudioSystem.stopResultSound();   // 【需求】停止胜利/失败音效
        this.switchScene('Game');
    }

    /** 返回首页 */
    public backToHome(): void {
        AudioSystem.stopResultSound();   // 【需求】停止胜利/失败音效
        this.switchScene('Menu');
    }

    // ==================== 兜底配置 ====================

    private getDefaultLevelConfig(): LevelConfig {
        return {
            levelId: 1,
            difficulty: 'easy',
            rows: 6,
            cols: 6,
            iconTypes: 5,
            initialUnlocked: [
                { row: 0, col: 0 }, { row: 1, col: 0 },
                { row: 0, col: 5 }, { row: 1, col: 5 },
                { row: 5, col: 0 }, { row: 5, col: 1 },
                { row: 4, col: 5 }, { row: 5, col: 5 },
            ],
        };
    }
}