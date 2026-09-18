// ============================================================
// assets/scripts/ui/DevPanel.ts
// 开发者模式面板（调试用，正式上线可删除或隐藏入口）
// 功能：
//   1. 关卡选择（1~15 关，点击直接跳转）
//   2. +5 心
//   3. 道具全部 +5
//   4. 重置存档
// ============================================================

import { _decorator, Component, Node, Button, Label, UITransform, director, Color } from 'cc';
import { GlobalData } from '../data/GlobalData';
import { SaveSystem } from '../systems/SaveSystem';
import { GameConfig } from '../data/GameConfig';
import { Logger } from '../utils/Logger';
import { HeartSystem } from '../systems/HeartSystem';
import { AudioSystem } from '../systems/AudioSystem';

const { ccclass, property } = _decorator;

@ccclass('DevPanel')
export class DevPanel extends Component {

    // ==================== 编辑器暴露属性 ====================

    @property({ type: Node, tooltip: '关卡按钮容器' })
    private gridContainer: Node | null = null;

    @property({ type: Button, tooltip: '+5心 按钮' })
    private addHeartsButton: Button | null = null;

    @property({ type: Button, tooltip: '道具+5 按钮' })
    private addPropsButton: Button | null = null;

    @property({ type: Button, tooltip: '重置存档按钮' })
    private resetSaveButton: Button | null = null;

    @property({ type: Button, tooltip: '关闭按钮' })
    private closeButton: Button | null = null;
        
    @property({ type: Button, tooltip: '-1心 按钮' })
    private loseHeartButton: Button | null = null;

    // ==================== 生命周期 ====================

    onLoad(): void {
        // ===== 兜底查找：编辑器没绑定 loseHeartButton 时按节点名自动找 =====
        if (!this.loseHeartButton) {
            // BtnLoseHeart 应该是 DevPanel 的直接子节点
            const btnNode = this.node.getChildByName('BtnLoseHeart');
            if (btnNode) {
                this.loseHeartButton = btnNode.getComponent(Button);
            }
        }

        // 绑定功能按钮
        this.addHeartsButton?.node.on(Button.EventType.CLICK, this.onAddHearts, this);
        this.addPropsButton?.node.on(Button.EventType.CLICK, this.onAddProps, this);
        this.resetSaveButton?.node.on(Button.EventType.CLICK, this.onResetSave, this);
        this.closeButton?.node.on(Button.EventType.CLICK, this.onClose, this);
        this.loseHeartButton?.node.on(Button.EventType.CLICK, this.onLoseHeart, this);

        // 【诊断】打印查找结果
        Logger.log(`DevPanel: loseHeartButton=${this.loseHeartButton ? '已找到' : '缺失'}`);

        // 初始隐藏
        this.node.active = false;
    }

    onDestroy(): void {
        this.addHeartsButton?.node?.off(Button.EventType.CLICK, this.onAddHearts, this);
        this.addPropsButton?.node?.off(Button.EventType.CLICK, this.onAddProps, this);
        this.resetSaveButton?.node?.off(Button.EventType.CLICK, this.onResetSave, this);
        this.closeButton?.node?.off(Button.EventType.CLICK, this.onClose, this);
    }

    // ==================== 公开方法 ====================

    /**
     * 打开面板（每次打开重建关卡按钮）
     */
    public show(): void {
        // 【诊断】确认 show 被调用
        Logger.log('DevPanel.show: 开发者面板 show 被调用');
        // 激活父级
        if (this.node.parent) {
            this.node.parent.active = true;
            // 【修复】强制把面板置顶
            this.node.setSiblingIndex(this.node.parent.children.length - 1);
        }
        this.node.active = true;
        // 【修复】若 onLoad 延迟执行覆盖（首次激活时 onLoad 会隐藏自身），下一帧补激活
        if (!this.node.activeInHierarchy) {
            this.scheduleOnce(() => {
                this.node.active = true;
            }, 0.05);
        }

        // 生成关卡按钮
        this.buildLevelGrid();

        Logger.log('DevPanel.show: 开发者模式已打开');
    }

    /** 关闭面板 */
    public hide(): void {
        this.node.active = false;
        if (this.node.parent) this.node.parent.active = false;
    }

    // ==================== 关卡网格 ====================

    /**
     * 动态生成 1~15 关按钮（每行 5 个，手动居中排布）
     */
    private buildLevelGrid(): void {
        if (!this.gridContainer) return;

        // 清空旧按钮
        this.gridContainer.destroyAllChildren();

        // 排布参数
        const TOTAL = 15;       // 生成 15 个关卡按钮
        const COLS = 5;         // 每行 5 个
        const ITEM_W = 110;     // 按钮宽
        const ITEM_H = 55;      // 按钮高
        const GAP_X = 15;       // 水平间距
        const GAP_Y = 15;       // 垂直间距

        const totalRows = Math.ceil(TOTAL / COLS);
        const gridHeight = totalRows * ITEM_H + (totalRows - 1) * GAP_Y;
        const firstRowY = (gridHeight - ITEM_H) / 2;

        for (let i = 0; i < TOTAL; i++) {
            const levelId = i + 1;
            const row = Math.floor(i / COLS);
            const col = i % COLS;

            // 当前行按钮数（最后一行可能不足）
            const countInRow = Math.min(COLS, TOTAL - row * COLS);
            const rowWidth = countInRow * ITEM_W + (countInRow - 1) * GAP_X;
            const rowStartX = -(rowWidth - ITEM_W) / 2;

            const posX = rowStartX + col * (ITEM_W + GAP_X);
            const posY = firstRowY - row * (ITEM_H + GAP_Y);

            // 创建按钮节点
            const btnNode = this.createLevelButton(levelId);
            btnNode.setParent(this.gridContainer);
            btnNode.setPosition(posX, posY, 0);
        }
        // 【新增】给动态创建的关卡按钮也绑定音效
        AudioSystem.bindButtonSounds(this.node);
    }

    /**
     * 动态创建一个关卡按钮节点
     */
    private createLevelButton(levelId: number): Node {
        // 根节点：UITransform（点击区域）+ Button（点击事件）
        const node = new Node(`DevLevel_${levelId}`);
        const uiTransform = node.addComponent(UITransform);
        uiTransform.setContentSize(110, 55);
        node.addComponent(Button);

        // 子节点：文字标签（显示"第X关"）
        const labelNode = new Node('Label');
        labelNode.setParent(node);
        const label = labelNode.addComponent(Label);
        label.string = `第${levelId}关`;
        label.fontSize = 22;
        label.color = new Color(255, 255, 255, 255);
        // 点击 → 跳转对应关卡
        node.on(Button.EventType.CLICK, () => {
            GlobalData.currentLevelId = levelId;
            director.loadScene('Game');
        });

        return node;
    }

    // ==================== 功能按钮 ====================

    /** +5 心 */
    private onAddHearts(): void {
        const data = SaveSystem.load();
        data.hearts = GameConfig.MAX_HEARTS;
        data.lastHeartTime = Date.now();
        SaveSystem.save(data);
        Logger.log('DevPanel: 爱心已回满 5 颗');
    }

    /** 所有道具 +5 */
    private onAddProps(): void {
        const data = SaveSystem.load();
        const propIds = [
            GameConfig.PROP_HINT,
            GameConfig.PROP_SHUFFLE,
            GameConfig.PROP_BOMB,
            GameConfig.PROP_SKILL,
        ];
        for (const propId of propIds) {
            data.props[propId] = (data.props[propId] ?? 0) + 5;
        }
        SaveSystem.save(data);
        Logger.log('DevPanel: 所有道具 +5');
    }

    /** 重置存档 */
    private onResetSave(): void {
        SaveSystem.reset();
        Logger.log('DevPanel: 存档已重置（下次进游戏从第 1 关开始）');
    }

    /** 关闭 */
    private onClose(): void {
        this.hide();
    }
     
    /** -1 心（调试用） */
    private onLoseHeart(): void {
        Logger.log('DevPanel.onLoseHeart: -1心按钮被点击');
        const hearts = HeartSystem.loseHeart();
        Logger.log(`DevPanel: 扣 1 心，剩余 ${hearts} 颗`);
    }
}