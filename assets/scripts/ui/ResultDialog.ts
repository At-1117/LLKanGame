// ============================================================
// assets/scripts/ui/ResultDialog.ts   【完整新版·第六阶段】
// 结算弹窗组件
// 两种模式：
//   1. 通关模式：显示剩余步数、星级，按钮[下一关][重玩][返回首页]
//   2. 失败模式：显示剩余爱心，按钮[重试(有心时)][返回首页]
// ============================================================

import { _decorator, Component, Label, Button, Node, UITransform, Color, Graphics, BlockInputEvents, Mask, MaskType } from 'cc';
import { GameConfig } from '../data/GameConfig';
import { AudioSystem } from '../systems/AudioSystem';
import { Logger } from '../utils/Logger';

const { ccclass, property } = _decorator;

@ccclass('ResultDialog')
export class ResultDialog extends Component {

    @property({ type: Label, tooltip: '标题标签' })
    private titleLabel: Label | null = null;

    @property({ type: Label, tooltip: '星级标签' })
    private starLabel: Label | null = null;

    @property({ type: Label, tooltip: '信息标签（剩余步数/剩余爱心）' })
    private scoreLabel: Label | null = null;

    @property({ type: Button, tooltip: '下一关按钮' })
    private nextButton: Button | null = null;

    @property({ type: Button, tooltip: '重玩/重试按钮' })
    private replayButton: Button | null = null;

    @property({ type: Label, tooltip: '重玩/重试按钮的文字标签' })
    private replayLabel: Label | null = null;

    @property({ type: Button, tooltip: '返回首页按钮' })
    private backButton: Button | null = null;

    // ==================== 运行时数据 ====================

    private _onNext: (() => void) | null = null;
    private _onReplay: (() => void) | null = null;
    private _onBack: (() => void) | null = null;

    /** 【需求】结算面板外圈白色圆角描边节点 */
    private _borderNode: Node | null = null;

    /** 【需求】结算面板背景圆角 Mask 已应用标志 */
    private _roundedMask: boolean = false;

    onLoad(): void {
        this.nextButton?.node.on(Button.EventType.CLICK, this.onNextClicked, this);
        this.replayButton?.node.on(Button.EventType.CLICK, this.onReplayClicked, this);
        this.backButton?.node.on(Button.EventType.CLICK, this.onBackClicked, this);
        // 初始隐藏
        this.node.active = false;
    }

    onDestroy(): void {
        this.nextButton?.node?.off(Button.EventType.CLICK, this.onNextClicked, this);
        this.replayButton?.node?.off(Button.EventType.CLICK, this.onReplayClicked, this);
        this.backButton?.node?.off(Button.EventType.CLICK, this.onBackClicked, this);
    }

    // ==================== 按钮处理 ====================

    private onNextClicked(): void {
        AudioSystem.playButtonSound();
        if (this._onNext) this._onNext();
    }
    private onReplayClicked(): void {
        AudioSystem.playButtonSound();
        if (this._onReplay) this._onReplay();
    }
    private onBackClicked(): void {
        AudioSystem.playButtonSound();
        if (this._onBack) this._onBack();
    }

    // ==================== 公开方法 ====================

    /** 注入回调 */
    public setCallbacks(onNext: () => void, onReplay: () => void, onBack: () => void): void {
        this._onNext = onNext;
        this._onReplay = onReplay;
        this._onBack = onBack;
    }

    /**
     * 通关模式
     * @param stepsLeft 剩余步数
     * @param stars 星级（1~3）
     * @param hasNext 是否还有下一关
     */
    public showSuccess(stepsLeft: number, stars: number, hasNext: boolean): void {
        // 【修复】同步激活（不再自身 scheduleOnce 延迟）：
        // 显示时机由调用方 GameManager 负责延迟调度（其组件挂在 Canvas 上始终激活，
        // 调度必然执行），本方法只需保证激活逻辑在任意同步上下文立即生效。
        this.activateDialog();

        // 【需求】结算面板外圈白色圆角描边
        this.ensureBorder();

        // 标题：显示"胜利"字样图，隐藏失败字样图
        const labelTile = this.node.getChildByName('LabelTile');
        if (labelTile) labelTile.active = true;
        const defeatTitle = this.node.getChildByName('DefeatTitle');
        if (defeatTitle) defeatTitle.active = false;

        // 【需求】删除星级显示
        if (this.starLabel) this.starLabel.node.active = false;

        // 剩余步数
        if (this.scoreLabel) {
            this.scoreLabel.node.active = true;
            this.scoreLabel.string = `剩余步数：${stepsLeft}`;
        }

        // 按钮布局：下一关 + 返回首页
        if (this.nextButton) {
            this.nextButton.node.active = hasNext;
            this.nextButton.node.setPosition(0, -60, 0);
        }
        if (this.replayButton) this.replayButton.node.active = false;
        // 【需求】胜利界面：返回首页按钮缩小到与"下一关"一致（320×126）
        if (this.backButton) {
            const ut = this.backButton.node.getComponent(UITransform);
            if (ut) ut.setContentSize(320, 126);
            this.backButton.node.setPosition(0, -200, 0);
        }

        Logger.log(`ResultDialog.showSuccess: 剩余步数=${stepsLeft}，星级=${stars}`);
    }

    /**
     * 失败模式（步数用完）
     * @param heartsLeft 剩余爱心数
     */
    public showFail(heartsLeft: number): void {
        // 【修复】同步激活（显示时机由 GameManager 延迟调度保证）
        this.activateDialog();

        // 【需求】结算面板外圈白色圆角描边
        this.ensureBorder();

        // 标题：显示"失败"字样图，隐藏胜利字样图
        const defeatTitle = this.node.getChildByName('DefeatTitle');
        if (defeatTitle) defeatTitle.active = true;
        const labelTile = this.node.getChildByName('LabelTile');
        if (labelTile) labelTile.active = false;

        // 清空星级
        if (this.starLabel) this.starLabel.string = '';

        // 【需求】取消"剩余爱心"显示
        if (this.scoreLabel) this.scoreLabel.node.active = false;

        // 按钮布局：重试 + 返回首页（【需求】取消"下一关"按钮）
        if (this.nextButton) this.nextButton.node.active = false;
        if (this.replayButton) {
            this.replayButton.node.active = heartsLeft > 0;
            this.replayButton.node.setPosition(0, 37, 0);
        }
        if (this.replayLabel) this.replayLabel.string = '重试';
        // 【需求】失败界面：返回按钮保持与"重试"一致（320×160）
        if (this.backButton) {
            const ut = this.backButton.node.getComponent(UITransform);
            if (ut) ut.setContentSize(320, 160);
            this.backButton.node.setPosition(0, -162, 0);
        }

        Logger.log(`ResultDialog.showFail: 剩余爱心=${heartsLeft}`);
    }

    /** 隐藏 */
    public hide(): void {
        // 初始隐藏面板自身
        this.node.active = false;
        // 【防御】同时隐藏父级容器（防止遮罩常显导致棋盘变暗）
        if (this.node.parent) {
            this.node.parent.active = false;
        }
    }

    /**
     * 【修复】激活弹窗（父级 + 自身）
     * 若激活后仍不在层级中（PopupLayer 被延迟执行的 onLoad 覆盖等极端情况），
     * 延迟一帧补激活一次，确保弹窗必然显示
     */
    private activateDialog(): void {
        if (this.node.parent) {
            this.node.parent.active = true;
            this.node.setSiblingIndex(this.node.parent.children.length - 1);
        }
        this.node.active = true;

        // 【需求】弹窗打开时拦截弹窗外点击（激活全屏遮罩 + BlockInputEvents）
        this.ensureInputBlocker();

        // 【需求】结算面板背景圆角 45°（无尖锐棱角）
        this.ensureRoundedMask();

        // 防御：激活后仍未生效 → 下一帧补激活（此时 onLoad 已执行完毕，不会再覆盖）
        if (!this.node.activeInHierarchy) {
            this.scheduleOnce(() => {
                if (this.node.parent) this.node.parent.active = true;
                this.node.active = true;
            }, 0.05);
        }
    }

    /**
     * 【需求】结算面板背景圆角 45°（无尖锐棱角）
     * 给面板节点加 Mask（GRAPHICS_STENCIL），在 Mask 自身节点的 Graphics 上
     * 绘制圆角矩形作为模板（引擎只读取 Mask 所在节点的 Graphics，子节点模板无效）
     */
    private ensureRoundedMask(): void {
        if (this._roundedMask) return;
        this._roundedMask = true;

        const panel = this.node.getComponent(UITransform);
        const w = panel ? panel.width : 460;
        const h = panel ? panel.height : 560;
        const pad = 8;       // 与描边一致外扩，避免把白色描边裁掉

        // Mask 组件（GRAPHICS_STENCIL：以自身节点 Graphics 为模板）
        const mask = this.node.addComponent(Mask);
        mask.type = MaskType.GRAPHICS_STENCIL;

        // 在 Mask 自身节点的 Graphics 上绘制圆角矩形模板
        const gfx = this.node.getComponent(Graphics);
        if (gfx) {
            gfx.clear();
            gfx.fillColor = new Color(255, 255, 255, 255);
            gfx.roundRect(-(w / 2 + pad), -(h / 2 + pad), w + pad * 2, h + pad * 2, 45);
            gfx.fill();
        }
    }

    /**
     * 【需求】弹窗打开时拦截弹窗外点击
     * 激活 PopupLayer 下已有的全屏 Mask（半透明黑遮罩），
     * 若不存在则动态创建全屏 BlockInputEvents 拦截节点。
     * 这样弹窗外的按钮（道具/格子等）无法再被点击。
     */
    private ensureInputBlocker(): void {
        const parent = this.node.parent;
        if (!parent) return;

        let mask = parent.getChildByName('Mask');
        if (!mask) {
            // 动态创建全屏拦截节点（无贴图，仅拦截点击）
            mask = new Node('Mask');
            mask.setParent(parent);
            // 放到子节点最底层，避免盖住面板（面板在上层可点击）
            mask.setSiblingIndex(0);
            const ut = mask.addComponent(UITransform);
            ut.setContentSize(750, 1334);
            mask.addComponent(BlockInputEvents);
        }

        // 确保有 BlockInputEvents（场景里已有的 Mask 可能没有该组件）
        if (!mask.getComponent(BlockInputEvents)) {
            mask.addComponent(BlockInputEvents);
        }

        mask.active = true;
    }

    /**
     * 【需求】结算面板外圈白色圆角描边（比面板大一圈，圆角 45°，仅首次创建）
     */
    private ensureBorder(): void {
        if (this._borderNode) return;

        const node = new Node('WhiteBorder');
        node.setParent(this.node);
        const gfx = node.addComponent(Graphics);
        const panel = this.node.getComponent(UITransform);
        const w = panel ? panel.width : 460;
        const h = panel ? panel.height : 560;

        gfx.lineWidth = 8;
        gfx.strokeColor = new Color(255, 255, 255, 255);
        const pad = 8;
        gfx.roundRect(-(w / 2 + pad), -(h / 2 + pad), w + pad * 2, h + pad * 2, 45);
        gfx.stroke();
        this._borderNode = node;
    }
}