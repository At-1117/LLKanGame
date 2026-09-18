// ============================================================
// assets/scripts/ui/SettingsDialog.ts
// 设置弹窗组件（主菜单和游戏场景共用）
// 包含：音效开关、背景音乐开关、震动开关
//       可选按钮：返回首页、重新开始（仅游戏场景绑定）
// ============================================================

import { _decorator, Component, Toggle, Button, Node, UITransform, Color, Graphics, Sprite, Label, Mask, MaskType, BlockInputEvents } from 'cc';
import { SaveSystem } from '../systems/SaveSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { Logger } from '../utils/Logger';

const { ccclass, property } = _decorator;

@ccclass('SettingsDialog')
export class SettingsDialog extends Component {

    // ==================== 编辑器暴露属性 ====================

    @property({ type: Toggle, tooltip: '音效开关 Toggle' })
    private soundToggle: Toggle | null = null;

    @property({ type: Toggle, tooltip: '背景音乐开关 Toggle' })
    private musicToggle: Toggle | null = null;

    @property({ type: Toggle, tooltip: '震动开关 Toggle' })
    private vibrationToggle: Toggle | null = null;

    @property({ type: Button, tooltip: '返回首页按钮（仅游戏场景绑定）' })
    private homeButton: Button | null = null;

    @property({ type: Button, tooltip: '重新开始按钮（仅游戏场景绑定）' })
    private restartButton: Button | null = null;

    @property({ type: Button, tooltip: '关闭按钮' })
    private closeButton: Button | null = null;

    // ==================== 运行时数据 ====================

    /** "返回首页"回调（由外部注入） */
    private _onHome: (() => void) | null = null;

    /** "重新开始"回调（由外部注入） */
    private _onRestart: (() => void) | null = null;

    /** 【需求】设置面板外圈白色描边节点（圆角，动态创建） */
    private _borderNode: Node | null = null;

    /** 【需求】关闭按钮已应用圆形白底红X样式标志 */
    private _closeStyled: boolean = false;

    /** 【需求】背景圆角 Mask 已应用标志 */
    private _roundedMask: boolean = false;

    // ==================== 生命周期 ====================

    onLoad(): void {
        // ===== 兜底查找：编辑器没绑定 Toggle 时按节点名自动找 =====
        // 适用于 Menu 和 Game 两个场景（Toggle 节点名相同）
        if (!this.soundToggle) {
            const node = this.node.getChildByName('ToggleSound');
            if (node) this.soundToggle = node.getComponent(Toggle);
        }
        if (!this.musicToggle) {
            const node = this.node.getChildByName('ToggleMusic');
            if (node) this.musicToggle = node.getComponent(Toggle);
        }
        if (!this.vibrationToggle) {
            const node = this.node.getChildByName('ToggleVibration');
            if (node) this.vibrationToggle = node.getComponent(Toggle);
        }

        // 绑定开关事件：Toggle 组件在其 node 上发 'toggle' 事件
        this.soundToggle?.node.on('toggle', this.onSoundToggled, this);
        this.musicToggle?.node.on('toggle', this.onMusicToggled, this);
        this.vibrationToggle?.node.on('toggle', this.onVibrationToggled, this);

        // 绑定按钮事件
        this.homeButton?.node.on(Button.EventType.CLICK, this.onHomeClicked, this);
        this.restartButton?.node.on(Button.EventType.CLICK, this.onRestartClicked, this);
        this.closeButton?.node.on(Button.EventType.CLICK, this.onCloseClicked, this);

        // 【诊断】打印查找结果
        Logger.log(`SettingsDialog: soundToggle=${this.soundToggle ? '已找到' : '缺失'}，` +
            `musicToggle=${this.musicToggle ? '已找到' : '缺失'}，` +
            `vibrationToggle=${this.vibrationToggle ? '已找到' : '缺失'}`);

        // 【修复】移除 onLoad 里的"初始隐藏"逻辑：
        // 面板在场景中本就是 inactive（PopupLayer 也 inactive），首次打开时
        // onLoad 才执行，若在此处隐藏会把刚 show() 激活的面板立刻关掉 → 需点两次。
        // 隐藏状态由场景文件 + hide() 保证，不再由 onLoad 干预。
    }

    onDestroy(): void {
        // 【修复】双重可选链：场景切换销毁时，引用的组件可能已被销毁，
        // node 可能是 null，直接 .off() 会崩溃
        this.soundToggle?.node?.off('toggle', this.onSoundToggled, this);
        this.musicToggle?.node?.off('toggle', this.onMusicToggled, this);
        this.vibrationToggle?.node?.off('toggle', this.onVibrationToggled, this);
        this.homeButton?.node?.off(Button.EventType.CLICK, this.onHomeClicked, this);
        this.restartButton?.node?.off(Button.EventType.CLICK, this.onRestartClicked, this);
        this.closeButton?.node?.off(Button.EventType.CLICK, this.onCloseClicked, this);
    }

    // ==================== 公开方法 ====================

    /**
     * 注入外部回调（GameManager 调用）
     * @param onHome 返回首页回调
     * @param onRestart 重新开始回调
     */
    public setCallbacks(onHome: () => void, onRestart: () => void): void {
        this._onHome = onHome;
        this._onRestart = onRestart;
    }

    /**
     * 打开弹窗（同步当前设置到开关状态）
     */
    public show(): void {
        // 激活父节点
        if (this.node.parent) {
            this.node.parent.active = true;
            // 【修复】强制把面板置顶，防止被背景/其他面板遮挡
            this.node.setSiblingIndex(this.node.parent.children.length - 1);
        }
        this.node.active = true;

        // 【需求】弹窗打开时拦截弹窗外点击（激活全屏遮罩 + BlockInputEvents）
        this.ensureInputBlocker();

        // 【需求】设置面板外圈白色圆角描边
        this.ensureBorder();

        // 【需求】设置背景圆角 45°（无尖锐棱角）
        this.ensureRoundedMask();

        // 【需求】关闭按钮：圆形白色底色 + 黑色X（隐藏原始方块贴图）
        this.ensureCloseButton();

        // 读取当前设置，同步到开关显示
        const settings = SaveSystem.getSettings();
        if (this.soundToggle) this.soundToggle.isChecked = settings.soundOn;
        if (this.musicToggle) this.musicToggle.isChecked = settings.musicOn;
        if (this.vibrationToggle) this.vibrationToggle.isChecked = settings.vibrationOn;

        Logger.log('SettingsDialog.show: 设置面板已打开');
    }

    /**
     * 关闭弹窗
     */
    public hide(): void {
        // 隐藏面板自身
        this.node.active = false;

        // 【修复】只有当父级下没有其他显示中的面板时才隐藏父级
        // 场景：结算弹窗（ResultPanel）还在显示时关闭设置面板，
        // 如果此时把父级 PopupLayer 藏掉，结算弹窗也会消失 → 界面卡死
        if (this.node.parent) {
            const resultPanel = this.node.parent.getChildByName('ResultPanel');
            const resultShowing = resultPanel ? resultPanel.activeInHierarchy : false;

            if (!resultShowing) {
                this.node.parent.active = false;
            }
        }
    }

    /**
     * 【需求】弹窗打开时拦截弹窗外点击
     * 激活 PopupLayer 下已有的全屏 Mask（半透明黑遮罩），
     * 若不存在则动态创建全屏 BlockInputEvents 拦截节点。
     * 这样弹窗外的按钮（道具/格子/开始游戏等）无法再被点击。
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
     * 【需求】设置背景圆角 45°（无尖锐棱角）
     * 给面板节点加 Mask（GRAPHICS_STENCIL），在 Mask 自身节点的 Graphics 上
     * 绘制圆角矩形作为模板（引擎只读取 Mask 所在节点的 Graphics，子节点模板无效）
     */
    private ensureRoundedMask(): void {
        if (this._roundedMask) return;
        // 【需求】仅游戏场景应用（Menu 场景无 homeButton，保持原有样式）
        if (!this.homeButton) return;
        this._roundedMask = true;

        const panel = this.node.getComponent(UITransform);
        const w = panel ? panel.width : 460;
        const h = panel ? panel.height : 560;
        const pad = 8;       // 与描边一致外扩，避免把白色描边裁掉

        // Mask 组件（GRAPHICS_STENCIL：以自身节点 Graphics 为模板）
        const mask = this.node.addComponent(Mask);
        mask.type = MaskType.GRAPHICS_STENCIL;

        // 【修复】在 Mask 自身节点的 Graphics 上绘制圆角矩形模板
        // （addComponent(Mask) 会自动创建 Graphics，模板必须画在它上面，
        //   画在子节点上引擎不读取，会导致 stencil 全失败 → 面板空白）
        // 【扩展】模板向下延伸覆盖"返回首页"按钮（BtnHome 在面板框外 y≈-345，
        //   若模板只覆盖面板 460×560，按钮会被 Mask 裁掉看不见）
        const gfx = this.node.getComponent(Graphics);
        if (gfx) {
            gfx.clear();
            gfx.fillColor = new Color(255, 255, 255, 255);
            // 主面板圆角矩形（外扩 pad）
            gfx.roundRect(-(w / 2 + pad), -(h / 2 + pad), w + pad * 2, h + pad * 2, 45);
            // 向下延伸覆盖返回首页按钮区域（按钮中心约 y=-345，半高 63 → 底边约 -408）
            gfx.roundRect(-(w / 2 + pad), -(h / 2 + 130), w + pad * 2, 130, 45);
            gfx.fill();
        }
    }

    /**
     * 【需求】关闭按钮：圆形白色底色 + 黑色X
     * 隐藏原有白色方块贴图与"×"文字，动态绘制圆形白底与黑色叉号
     * 【修复】Graphics 挂在按钮的子节点上（避免与按钮节点上的 Sprite 同节点冲突导致不显示）
     */
    private ensureCloseButton(): void {
        if (this._closeStyled || !this.closeButton) return;
        this._closeStyled = true;

        const btnNode = this.closeButton.node;

        // 隐藏原始 Sprite（白色方块）与子 Label（×）
        const sp = btnNode.getComponent(Sprite);
        if (sp) sp.enabled = false;
        const lab = btnNode.getComponentInChildren(Label);
        if (lab) lab.node.active = false;

        // 在按钮的子节点上加 Graphics：白色圆形底色
        const gNode = new Node('CloseGraphic');
        gNode.setParent(btnNode);
        const gfx = gNode.addComponent(Graphics);
        gfx.fillColor = new Color(255, 255, 255, 255);
        gfx.circle(0, 0, 22);
        gfx.fill();

        // 黑色 X
        gfx.lineWidth = 5;
        gfx.strokeColor = new Color(0, 0, 0, 255);
        gfx.moveTo(-11, -11);
        gfx.lineTo(11, 11);
        gfx.moveTo(11, -11);
        gfx.lineTo(-11, 11);
        gfx.stroke();
    }

    /**
     * 【需求】创建设置面板外圈白色描边（比面板大一圈，圆角 45°，仅首次创建）
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
        const pad = 8;       // 外扩 8px
        // 圆角矩形（圆角半径 45，无尖锐棱角）
        gfx.roundRect(-(w / 2 + pad), -(h / 2 + pad), w + pad * 2, h + pad * 2, 45);
        gfx.stroke();
        this._borderNode = node;
    }

    // ==================== 事件处理 ====================

    /** 音效开关切换 */
    private onSoundToggled(toggle: Toggle): void {
        SaveSystem.setSoundOn(toggle.isChecked);

        // 【修复】关闭音效的瞬间，立即停止所有正在播放的音效
        // （否则关开关前点的格子音效会继续播完，被误以为是"按钮音效"）
        if (!toggle.isChecked) {
            AudioSystem.stopAllClickSounds();
        }

        Logger.log(`SettingsDialog: 音效 ${toggle.isChecked ? '开' : '关'}`);
    }

    /** 背景音乐开关切换 */
    private onMusicToggled(toggle: Toggle): void {
        SaveSystem.setMusicOn(toggle.isChecked);
        // 立即刷新 BGM 播放状态
        AudioSystem.refreshBgm();
        Logger.log(`SettingsDialog: 背景音乐 ${toggle.isChecked ? '开' : '关'}`);
    }

    /** 震动开关切换 */
    private onVibrationToggled(toggle: Toggle): void {
        SaveSystem.setVibrationOn(toggle.isChecked);
        Logger.log(`SettingsDialog: 震动 ${toggle.isChecked ? '开' : '关'}`);
    }

    /** 返回首页 */
    private onHomeClicked(): void {
        AudioSystem.playButtonSound();
        if (this._onHome) this._onHome();
    }

    /** 重新开始 */
    private onRestartClicked(): void {
        AudioSystem.playButtonSound();
        if (this._onRestart) this._onRestart();
    }

    /** 关闭 */
    private onCloseClicked(): void {
        AudioSystem.playButtonSound();
        this.hide();
    }
}