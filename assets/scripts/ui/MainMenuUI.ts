// ============================================================
// assets/scripts/ui/MainMenuUI.ts   【完整新版·血量改造】
// 主菜单组件
// 功能：
//   1. 开始游戏（检查心数，直入当前关卡）
//   2. 设置按钮（左上角）
//   3. 顶部爱心显示：❤️ + 数量 + 加号按钮
//   4. 血量不满时显示恢复倒计时（每秒刷新）
// ============================================================

import { _decorator, Component, Button, Label, Node, UITransform, Color, director } from 'cc';
import { SaveSystem } from '../systems/SaveSystem';
import { HeartSystem } from '../systems/HeartSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { SettingsDialog } from './SettingsDialog';
import { GameConfig } from '../data/GameConfig';
import { GlobalData } from '../data/GlobalData';
import { Logger } from '../utils/Logger';
import { DevPanel } from './DevPanel';

const { ccclass, property } = _decorator;

@ccclass('MainMenuUI')
export class MainMenuUI extends Component {

    // ==================== 编辑器暴露属性 ====================

    @property({ type: Button, tooltip: '开始游戏按钮' })
    private startButton: Button | null = null;

    @property({ type: Button, tooltip: '设置按钮' })
    private settingsButton: Button | null = null;

    @property({ type: Button, tooltip: '添加爱心按钮（+号）' })
    private addHeartButton: Button | null = null;

    @property({ type: Label, tooltip: '爱心恢复倒计时标签' })
    private heartTimerLabel: Label | null = null;

    @property({ type: SettingsDialog, tooltip: '设置弹窗组件' })
    private settingsDialog: SettingsDialog | null = null;
    
    @property({ type: Button, tooltip: '开发者模式按钮' })
    private devButton: Button | null = null;

    @property({ type: DevPanel, tooltip: '开发者面板组件' })
    private devPanel: DevPanel | null = null;

    /** 【UX】临时提示 Label（动态创建，体力不足等场景显示） */
    private _toastLabel: Label | null = null;

    /** 【贴图】爱心数字 Label（动态创建，图标由场景 Sprite 显示） */
    private _heartCountLabel: Label | null = null;
    // ==================== 生命周期 ====================

    onLoad(): void {
        // ===== 兜底查找：编辑器没绑定时按节点名自动找 =====
        if (!this.devButton) {
            // BtnDev 是 Canvas 的直接子节点
            const btnNode = this.node.getChildByName('BtnDev');
            if (btnNode) {
                this.devButton = btnNode.getComponent(Button);
            }
        }
        if (!this.devPanel) {
            // DevPanel 在 PopupLayer 下
            const popupLayer = this.node.getChildByName('PopupLayer');
            const panelNode = popupLayer?.getChildByName('DevPanel');
            if (panelNode) {
                this.devPanel = panelNode.getComponent(DevPanel);
            }
        }

        // ===== 绑定按钮 =====
        this.startButton?.node.on(Button.EventType.CLICK, this.onStartClicked, this);
        this.settingsButton?.node.on(Button.EventType.CLICK, this.onSettingsClicked, this);
        this.addHeartButton?.node.on(Button.EventType.CLICK, this.onAddHeartClicked, this);
        this.devButton?.node.on(Button.EventType.CLICK, this.onDevClicked, this);

        // 【诊断】打印查找结果
        Logger.log(`MainMenuUI: devButton=${this.devButton ? '已找到' : '缺失'}，` +
            `devPanel=${this.devPanel ? '已找到' : '缺失'}`);

        // 【新增】给菜单所有按钮绑定统一音效
        AudioSystem.bindButtonSounds(this.node);
    }

    onDestroy(): void {
        // 解绑按钮
        this.startButton?.node?.off(Button.EventType.CLICK, this.onStartClicked, this);
        this.settingsButton?.node?.off(Button.EventType.CLICK, this.onSettingsClicked, this);
        this.addHeartButton?.node?.off(Button.EventType.CLICK, this.onAddHeartClicked, this);
        // 停止每秒刷新调度
        this.unschedule(this.refreshHearts);
        // 停止提示隐藏调度
        this.unschedule(this.hideToast);
    }

    start(): void {
        // 【根治】进入菜单场景立即清场，杜绝跨场景音效残留
        AudioSystem.stopAllClickSounds();
        
        // 首次刷新爱心显示
        this.refreshHearts();

        // 每秒刷新一次（自动结算离线恢复 + 倒计时走动）
        this.schedule(this.refreshHearts, 1);

        // 预加载并播放背景音乐
        AudioSystem.preloadBgm().then(() => {
            // 【需求】回到 Menu 界面恢复背景音乐原始音量
            AudioSystem.setBgmVolume(1);
            AudioSystem.refreshBgm();
        });

        // 【需求】预加载统一按钮音效（主菜单按钮点击有声音）
        AudioSystem.preloadButtonSound();
    }

    // ==================== 按钮处理 ====================

    /**
     * 点击"开始游戏"
     */
    private onStartClicked(): void {
        // 检查心数
        const hearts = HeartSystem.getHearts();
        if (hearts <= 0) {
            const seconds = HeartSystem.getSecondsToNextHeart();
            const mm = Math.floor(seconds / 60);
            const ss = seconds % 60;
            const mmStr = mm < 10 ? `0${mm}` : `${mm}`;
            const ssStr = ss < 10 ? `0${ss}` : `${ss}`;
            // 【UX】给玩家明确反馈：体力不足 + 恢复倒计时
            this.showToast(`体力不足，${mmStr}:${ssStr} 后恢复`);
            Logger.warn(`MainMenuUI: 没有心了！还需 ${mmStr}:${ssStr} 恢复`);
            return;
        }

        // 记录本次要玩的关卡（从存档读取）
        GlobalData.currentLevelId = SaveSystem.load().currentLevel;

        // 【新增】停止残留音效
        AudioSystem.stopAllClickSounds();

        // 【修复】延迟切换场景：先播放按钮音效（btn.mp3 约 0.5s，直接切按钮无声）
        this.scheduleOnce(() => {
            director.loadScene('Game');
        }, 0.5);
    }

    /**
     * 点击"设置"按钮
     */
    private onSettingsClicked(): void {
        this.settingsDialog?.show();
    }

    /**
     * 点击"加号"按钮（添加爱心）
     */
    private onAddHeartClicked(): void {
        const hearts = HeartSystem.getHearts();

        // 已满：提示
        if (hearts >= GameConfig.MAX_HEARTS) {
            Logger.log('MainMenuUI: 爱心已满，不需要添加');
            return;
        }

        // TODO: 后续抖音适配时，替换为"看激励视频广告后 +1 心"
        // 临时实现：直接 +1 心（方便测试）
        HeartSystem.addHeart();

        // 刷新显示
        this.refreshHearts();

        Logger.log('MainMenuUI: 爱心 +1（临时实现，后续替换为看广告）');
    }

    // ==================== 显示刷新 ====================

    /**
     * 刷新爱心显示和恢复倒计时
     */
    private refreshHearts(): void {
        const hearts = HeartSystem.getHearts();
        const max = GameConfig.MAX_HEARTS;

        // ===== 爱心数字显示 =====
        // 爱心图标由场景 Sprite（icon_heart）显示；
        // 数字在这里动态创建/更新（挂在 HeartsLabel 节点右侧）
        const heartNode = this.node.getChildByName('HeartsLabel');
        if (heartNode) {
            if (!this._heartCountLabel) {
                const node = new Node('HeartCount');
                node.setParent(heartNode);
                const ut = node.addComponent(UITransform);
                ut.setContentSize(50, 40);
                const label = node.addComponent(Label);
                label.fontSize = 32;
                label.lineHeight = 38;
                label.isBold = true;
                label.color = new Color(255, 255, 255, 255);
                // 显示在爱心图标（中心 0）和 +号按钮（x=100）的正中间
                node.setPosition(48, 0, 0);
                this._heartCountLabel = label;
            }
            this._heartCountLabel.string = `${hearts}`;
            this._heartCountLabel.node.active = true;
        }

        // ===== 恢复倒计时 =====
        if (this.heartTimerLabel) {
            if (hearts >= max) {
                // 满血：隐藏倒计时
                this.heartTimerLabel.node.active = false;
            } else {
                // 不满：显示倒计时（mm:ss 格式）
                this.heartTimerLabel.node.active = true;

                const seconds = HeartSystem.getSecondsToNextHeart();
                const mm = Math.floor(seconds / 60);
                const ss = seconds % 60;
                // 手写补零
                const mmStr = mm < 10 ? `0${mm}` : `${mm}`;
                const ssStr = ss < 10 ? `0${ss}` : `${ss}`;

                this.heartTimerLabel.string = `${mmStr}:${ssStr}`;
            }
        }
    }

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
            uiTransform.setContentSize(700, 60);
            const label = node.addComponent(Label);
            label.fontSize = 32;
            label.lineHeight = 44;
            label.color = new Color(255, 230, 120, 255);
            node.setPosition(0, -220, 0);
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

    /**
     * 点击"开发者"按钮
     */
    private onDevClicked(): void {
        Logger.log('MainMenuUI.onDevClicked: 开发者按钮被点击');
        if (this.devPanel) {
            this.devPanel.show();
        } else {
            Logger.warn('MainMenuUI.onDevClicked: devPanel 未找到，无法打开');
        }
    }
}