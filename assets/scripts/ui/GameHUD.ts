// ============================================================
// assets/scripts/ui/GameHUD.ts
// 游戏内 HUD 组件
// 挂载在场景中的 UILayer 节点上
// 负责：显示分数、显示道具数量、转发道具按钮点击
//
// 注意：本文件不 import GameManager，而是通过注入回调的方式通信，
// 避免 GameHUD ↔ GameManager 互相 import 造成循环依赖
// ============================================================

import { _decorator, Component, Label, Button, Node, Color, Graphics } from 'cc';
import { GameConfig } from '../data/GameConfig';
import { AudioSystem } from '../systems/AudioSystem';
import { Logger } from '../utils/Logger';

const { ccclass, property } = _decorator;

@ccclass('GameHUD')
export class GameHUD extends Component {

    // ==================== 编辑器暴露属性（都从场景中拖拽赋值） ====================

    /** 分数标签（TopBar 下的 LabelScore 的 Label 组件） */
    @property({ type: Label, tooltip: '分数标签（LabelScore 节点）' })
    private scoreLabel: Label | null = null;

    /** 提示按钮上的文字标签（用于显示"提示 x3"） */
    @property({ type: Label, tooltip: '提示按钮文字（BtnHint 下的 Label 子节点）' })
    private hintLabel: Label | null = null;

    /** 重排按钮上的文字标签 */
    @property({ type: Label, tooltip: '重排按钮文字（BtnShuffle 下的 Label 子节点）' })
    private shuffleLabel: Label | null = null;

    /** 炸弹按钮上的文字标签 */
    @property({ type: Label, tooltip: '炸弹按钮文字（BtnBomb 下的 Label 子节点）' })
    private bombLabel: Label | null = null;

    /** 提示按钮组件 */
    @property({ type: Button, tooltip: '提示按钮（BtnHint 节点上的 Button 组件）' })
    private hintButton: Button | null = null;

    /** 重排按钮组件 */
    @property({ type: Button, tooltip: '重排按钮（BtnShuffle 节点上的 Button 组件）' })
    private shuffleButton: Button | null = null;

    /** 炸弹按钮组件 */
    @property({ type: Button, tooltip: '炸弹按钮（BtnBomb 节点上的 Button 组件）' })
    private bombButton: Button | null = null;

    /** 返回按钮（TopBar 下的 BtnBack） */
    @property({ type: Button, tooltip: '返回按钮（BtnBack 节点）' })
    private backButton: Button | null = null;

    /** 解锁技能按钮 */
    @property({ type: Button, tooltip: '解锁技能按钮（BtnSkill 节点）' })
    private skillButton: Button | null = null;

    /** 关卡名标签（TopBar 下的 LabelLevel） */
    @property({ type: Label, tooltip: '关卡名标签（LabelLevel 节点）' })
    private levelLabel: Label | null = null;

    /** 解锁技能按钮上的文字标签（显示"⚡解锁 x3"） */
    @property({ type: Label, tooltip: '解锁技能按钮文字（BtnSkill 下的 Label）' })
    private skillLabel: Label | null = null;

    // ==================== 运行时数据 ====================

    /**
     * 道具点击回调（由 GameManager 注入）
     * 点击某个道具按钮时，把道具ID传出去
     */
    private _onPropClicked: ((propId: string) => void) | null = null;

    /** 返回按钮点击回调（由 GameManager 注入） */
    private _onBackClicked: (() => void) | null = null;

    /** 解锁技能点击回调（由 GameManager 注入） */
    private _onSkillClicked: (() => void) | null = null;

    // ==================== 生命周期方法 ====================

        onLoad(): void {
        Logger.log('GameHUD 组件已加载');

        // 绑定四个道具按钮（原有，不变）
        this.hintButton?.node.on(Button.EventType.CLICK, this.onHintClicked, this);
        this.shuffleButton?.node.on(Button.EventType.CLICK, this.onShuffleClicked, this);
        this.bombButton?.node.on(Button.EventType.CLICK, this.onBombClicked, this);
        this.skillButton?.node.on(Button.EventType.CLICK, this.onSkillClicked, this);

        // ===== 设置按钮：兜底查找 + 触摸事件绑定 =====
        // 情况1：编辑器没绑定 backButton → 按节点名自动查找
        if (!this.backButton) {
            // UILayer 下找 TopBar，再找 BtnSettings（兼容旧名 BtnBack）
            const topBar = this.node.getChildByName('TopBar');
            const btnNode = topBar?.getChildByName('BtnSettings') ?? topBar?.getChildByName('BtnBack');
            if (btnNode) {
                this.backButton = btnNode.getComponent(Button);
            }
        }

        // 情况2：找到了按钮 → 用触摸事件绑定（TOUCH_END 比 Button 的 CLICK 更底层可靠）
        if (this.backButton) {
            this.backButton.node.on(Node.EventType.TOUCH_END, this.onBackClicked, this);
            Logger.log(`GameHUD: 设置按钮已绑定 → ${this.backButton.node.name}`);
        } else {
            // 情况3：彻底找不到 → 明确报错
            Logger.warn('GameHUD: 找不到设置按钮节点（UILayer/TopBar/BtnSettings）！');
        }

        // 【角标】为 4 个道具按钮创建蓝色圆点角标背景
        this.ensureBadgeBackground(this.hintLabel?.node ?? null);
        this.ensureBadgeBackground(this.shuffleLabel?.node ?? null);
        this.ensureBadgeBackground(this.bombLabel?.node ?? null);
        this.ensureBadgeBackground(this.skillLabel?.node ?? null);
    }

    /**
     * 【角标】为道具角标创建蓝色圆点背景
     * 动态创建 Graphics 圆点节点，插到角标 Label 之前（下层），
     * 数字 / "+" 显示在蓝色圆点上
     * @param labelNode 角标 Label 节点
     */
    private ensureBadgeBackground(labelNode: Node | null): void {
        if (!labelNode || !labelNode.parent) return;
        const parent = labelNode.parent;
        // 已创建过则跳过（避免重复）
        if (parent.getChildByName('BadgeBg')) return;

        const bg = new Node('BadgeBg');
        const gfx = bg.addComponent(Graphics);
        gfx.fillColor = new Color(30, 120, 230, 255);   // 蓝色圆点
        gfx.circle(0, 0, 22);                            // 半径 22（覆盖 44x44 角标区域）
        gfx.fill();

        bg.setPosition(labelNode.position);              // 与角标同位置
        bg.setParent(parent);
        bg.setSiblingIndex(labelNode.getSiblingIndex()); // 插到 Label 之前（下层）
    }

    onDestroy(): void {
        // 注销道具按钮事件（双重可选链）
        this.hintButton?.node?.off(Button.EventType.CLICK, this.onHintClicked, this);
        this.shuffleButton?.node?.off(Button.EventType.CLICK, this.onShuffleClicked, this);
        this.bombButton?.node?.off(Button.EventType.CLICK, this.onBombClicked, this);
        this.skillButton?.node?.off(Button.EventType.CLICK, this.onSkillClicked, this);
        // 注销设置按钮触摸事件
        this.backButton?.node?.off(Node.EventType.TOUCH_END, this.onBackClicked, this);
    }

    // ==================== 按钮点击处理 ====================

    /** 点击"提示"按钮 */
    private onHintClicked(): void {
        // 【需求】播放提示按钮专用音效
        AudioSystem.playPropSound(GameConfig.PROP_HINT);
        // 把道具ID传给 GameManager 处理
        if (this._onPropClicked) {
            this._onPropClicked(GameConfig.PROP_HINT);
        }
    }

    /** 点击"重排"按钮 */
    private onShuffleClicked(): void {
        // 【需求】播放重排按钮专用音效
        AudioSystem.playPropSound(GameConfig.PROP_SHUFFLE);
        if (this._onPropClicked) {
            this._onPropClicked(GameConfig.PROP_SHUFFLE);
        }
    }

    /** 点击"炸弹"按钮 */
    private onBombClicked(): void {
        // 【需求】播放炸弹按钮专用音效
        AudioSystem.playPropSound(GameConfig.PROP_BOMB);
        if (this._onPropClicked) {
            this._onPropClicked(GameConfig.PROP_BOMB);
        }
    }

    /**
     * 【技能】技能按钮被点击
     */
    private onSkillClicked(): void {
        // 【需求】技能音效用独立音源播放（btnskill 较长，类似 bgm 的播放方式）
        AudioSystem.playSkillSound();
        if (this._onSkillClicked) {
            this._onSkillClicked();
        }
    }

    // ==================== 公开方法 ====================

    /**
     * 注入道具点击回调（由 GameManager 在初始化时调用）
     * @param callback 回调函数，参数为道具ID
     */
    public setPropClickHandler(callback: (propId: string) => void): void {
        this._onPropClicked = callback;
    }

        /**
     * 【第四阶段B 新增】注入返回按钮回调
     * @param callback 回调函数
     */
    public setBackClickHandler(callback: () => void): void {
        this._onBackClicked = callback;
    }

    /**
     * 【第四阶段B 新增】点击"返回"按钮
     */
    private onBackClicked(): void {
        // 【诊断】确认按钮点击事件到达
        Logger.log('GameHUD.onBackClicked: 设置按钮被点击了');
        if (this._onBackClicked) {
            this._onBackClicked();
        } else {
            // 回调为空说明 GameManager 没注入
            Logger.warn('GameHUD.onBackClicked: 回调为空（GameManager 未注入）');
        }
    }

    /**
     * 【第六阶段修改】更新剩余步数显示
     * @param remaining 剩余步数
     * @param total 初始总步数
     */
    public updateSteps(remaining: number, total: number): void {
        if (this.scoreLabel) {
            // 【修改】只显示剩余步数，不显示总步数
            this.scoreLabel.string = `剩余步数：${remaining}`;
        }
    }

    /**
     * 【需求】更新关卡名显示（取消难度显示）
     * @param levelId 关卡编号
     * @param difficulty 难度（参数保留，不再显示）
     */
    public updateLevel(levelId: number, difficulty: string): void {
        if (!this.levelLabel) return;

        // 【需求】只显示关卡号，不显示难度
        this.levelLabel.string = `第${levelId}关`;
    }

    /**
     * 更新道具数量角标
     * 角标规则：数量 > 0 显示数字；数量 = 0 显示"+"（提示可获取）
     * 按钮始终保持可点击，用尽时由 GameManager 弹提示
     * @param propId 道具ID
     * @param count 剩余数量
     */
    public updatePropCount(propId: string, count: number): void {
        // 根据道具ID选择对应的角标标签
        let label: Label | null = null;

        // 用 if 判断道具类型
        if (propId === GameConfig.PROP_HINT) {
            label = this.hintLabel;
        } else if (propId === GameConfig.PROP_SHUFFLE) {
            label = this.shuffleLabel;
        } else if (propId === GameConfig.PROP_BOMB) {
            label = this.bombLabel;
        } else if (propId === GameConfig.PROP_SKILL) {
            label = this.skillLabel;
        }

        // 【角标】数量 > 0 显示数字；= 0 显示 +（可获取）
        if (label) {
            label.string = count > 0 ? `${count}` : '+';
            label.color = count > 0
                ? new Color(255, 255, 255, 255)   // 有数量：白色数字
                : new Color(255, 200, 60, 255);   // 用尽：金色 +
        }
    }

    /**
     * 【技能】注入技能点击回调
     */
    public setSkillClickHandler(callback: () => void): void {
        this._onSkillClicked = callback;
    }
}