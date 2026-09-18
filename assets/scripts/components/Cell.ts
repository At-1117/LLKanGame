import { _decorator, Component, Sprite, Color, UITransform, EventTouch, tween, Vec3, Node, SpriteFrame, Graphics } from 'cc';

// 从 data 模块导入格子数据结构和状态枚举
import { CellData, CellState } from '../data/CellData';
import { GameConfig } from '../data/GameConfig';
import { Logger } from '../utils/Logger';
// 图案贴图管理器（第五阶段新增）
import { IconManager } from '../systems/IconManager';

const { ccclass, property } = _decorator;

// ============================================================
// assets/scripts/components/Cell.ts   【完整新版·含第三阶段升级】
// 单个棋盘格子的组件
// 挂载到每一个 Cell 预制体 / 动态创建的格子节点上
// ============================================================
@ccclass('Cell')
export class Cell extends Component {

    // ==================== 编辑器暴露属性 ====================

    /** 格子背景的 Sprite 组件引用（用于显示锁定蒙版 / 选中高亮） */
    @property({ type: Sprite, tooltip: '格子背景的 Sprite 组件' })
    private bgSprite: Sprite | null = null;

    /** 图案图标的 Sprite 组件引用（用于显示图案 icon） */
    @property({ type: Sprite, tooltip: '图案图标的 Sprite 组件' })
    private iconSprite: Sprite | null = null;

    // ==================== 运行时数据 ====================

    /** 该格子对应的数据对象（棋盘二维数组中的引用） */
    private _cellData: CellData | null = null;

    /** 格子尺寸（像素），初始化时根据 GameConfig 计算 */
    private _cellSize: number = GameConfig.CELL_SIZE;

    // 【新增】玩家点击回调（由 GameManager 注入）
    // 当玩家点击了这个格子（且状态允许点击）时，回调会被调用
    private _onClickCallback: ((row: number, col: number) => void) | null = null;

    // 【新增】消除动画完成回调（由 GameManager 注入）
    // 当消除动画播放完毕、格子变为空白后，回调会被调用
    private _onRemovedCallback: (() => void) | null = null;
    // 提示闪烁动画的 Tween 句柄
    // 保存引用是为了在需要时能停止动画
    private _hintTween: ReturnType<typeof tween> | null = null;

    // 【修复】选中弹跳动画句柄（防止"变大未变回"：停止旧动画并恢复缩放）
    private _selectTween: ReturnType<typeof tween> | null = null;

    // 【需求】选中高亮边框节点（Graphics 绘制，图案充满格子后背景被遮挡，改用边框提示选中）
    private _selectBorderNode: Node | null = null;

    // 【需求】提示高亮边框节点（金色，提示道具高亮）
    private _hintBorderNode: Node | null = null;

    // ==================== 生命周期方法 ====================

    /**
     * 组件加载时调用（初始化最早时机）
     * 在这里注册触摸事件监听
     */
    onLoad(): void {
        // 【新增】注册触摸结束事件
        // Node.EventType.TOUCH_END：手指在节点上抬起时触发
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    /**
     * 组件销毁时调用
     * 在这里移除事件监听，防止内存泄漏
     */
    onDestroy(): void {
        // 【新增】注销触摸事件
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    // ==================== 触摸事件处理 ====================

    /**
     * 【新增】触摸结束事件处理器
     * 根据格子当前状态决定如何响应点击
     * 
     * @param event 触摸事件对象（含点击坐标等信息）
     */
    private onTouchEnd(event: EventTouch): void {
        // 【需求】点击格子后阻止事件冒泡到棋盘层
        // （否则会误触发"点击空白取消选中"，刚选中就被取消）
        event.propagationStopped = true;

        // 安全检查：数据为空则忽略
        if (!this._cellData) return;

        // 读取当前格子的状态
        const state = this._cellData.state;

        // ===== 情况1：已解锁 或 已选中 → 通知 GameManager 处理点击 =====
        if (state === CellState.UNLOCKED || state === CellState.SELECTED) {
            // 调用回调，把格子的行列号传给 GameManager
            if (this._onClickCallback) {
                this._onClickCallback(this._cellData.row, this._cellData.col);
            }
        }
        // ===== 情况2：锁定状态 → 播放抖动动画提示"不可点击" =====
        else if (state === CellState.LOCKED) {
            this.playShakeAnimation();
        }
        // ===== 情况3：消除中/空白 → 完全忽略 =====
        // REMOVING 和 EMPTY 状态不需要任何响应
    }

    // ==================== 公开方法（回调注入） ====================

    /**
     * 【新增】设置点击回调
     * 由 GameManager 在创建棋盘后调用，把点击处理逻辑注入进来
     * 
     * @param callback 回调函数，参数为 (行号, 列号)
     */
    public setClickCallback(callback: (row: number, col: number) => void): void {
        this._onClickCallback = callback;
    }

    /**
     * 【新增】设置消除完成回调
     * 由 GameManager 在发起消除时调用
     * 
     * @param callback 回调函数（无参数）
     */
    public setRemovedCallback(callback: () => void): void {
        this._onRemovedCallback = callback;
    }

    // ==================== 公开方法 ====================

    /**
     * 初始化格子
     * @param cellData 格子数据对象
     * @param cellSize 格子显示尺寸（像素）
     */
        public init(cellData: CellData, cellSize: number = GameConfig.CELL_SIZE): void {
        // 保存数据引用
        this._cellData = cellData;
        // 保存尺寸
        this._cellSize = cellSize;

        // 设置节点大小
        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setContentSize(this._cellSize, this._cellSize);
        }

        if (this.iconSprite) {
            // 尺寸模式设为 CUSTOM；具体尺寸在 applyIconTexture 里按原图等比设置
            this.iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }

        // 根据当前数据状态刷新视觉表现
        this.refreshView();
    }

    /**
     * 刷新格子的视觉表现
     * 根据 CellData.state 来切换不同的显示效果
     */
    public refreshView(): void {
        // 安全检查：如果数据为空，直接返回
        if (!this._cellData) {
            Logger.warn('Cell.refreshView: 格子数据为空，无法刷新');
            return;
        }

        // 根据状态枚举来切换显示
        switch (this._cellData.state) {

            case CellState.LOCKED:
                // 锁定状态：显示灰色蒙版，隐藏图标
                this.showLocked();
                break;

            case CellState.UNLOCKED:
                // 解锁状态：显示图标，正常颜色
                this.showUnlocked();
                break;

            case CellState.SELECTED:
                // 选中状态：高亮底色
                this.showSelected();
                break;

            case CellState.REMOVING:
                // 消除动画中：播放缩小消失动画
                this.showRemoving();
                break;

            case CellState.EMPTY:
                // 空白状态：完全隐藏
                this.showEmpty();
                break;

            default:
                Logger.warn(`Cell.refreshView: 未知状态 ${this._cellData.state}`);
                break;
        }
    }

    /**
     * 获取该格子对应的数据对象
     */
    public getCellData(): CellData | null {
        return this._cellData;
    }

    /**
     * 【修复】按原图宽高比等比缩放图标尺寸
     * 规则：最长边 = 格子边长的 100%（图案充满格子），
     * 另一边按比例，保证不变形
     * @param frame 图案的 SpriteFrame
     */
    private fitIconToCell(frame: SpriteFrame): void {
        try {
            if (!this.iconSprite) return;
            const original = frame.originalSize;
            if (!original || original.width <= 0 || original.height <= 0) {
                const size = this._cellSize;
                const transform = this.iconSprite.node.getComponent(UITransform);
                if (transform) transform.setContentSize(size, size);
                return;
            }
            const maxSize = this._cellSize;
            const scale = maxSize / Math.max(original.width, original.height);
            const w = original.width * scale;
            const h = original.height * scale;
            const transform = this.iconSprite.node.getComponent(UITransform);
            if (transform) transform.setContentSize(w, h);
        } catch (err) {
            // 缩放失败只记录警告，不打断游戏
            Logger.warn('Cell.fitIconToCell: 图标缩放失败', err);
        }
    }
    /**
     * 【第五阶段新增】根据格子当前的 iconType 应用真实图案贴图
     * 
     * 行为：
     *   1. iconType <= 0（无图案）→ 隐藏图标
     *   2. 缓存中有该图案 → 设置到 iconSprite
     *   3. 缓存中没有（未加载/文件缺失）→ 保持预制体上预设的占位图
     */
    private applyIconTexture(): void {
        // 安全检查
        if (!this._cellData || !this.iconSprite) return;

        // 获取图案类型
        const iconType = this._cellData.iconType;

        // 无图案 → 隐藏图标
        if (iconType <= 0) {
            this.iconSprite.node.active = false;
            return;
        }

        // 从缓存取真实图案（关卡开始前已预加载）
        const spriteFrame = IconManager.getIcon(iconType);
        if (spriteFrame) {
            // 命中缓存 → 换上真实图案
            this.iconSprite.spriteFrame = spriteFrame;

            // 【修复】按原图宽高比等比缩放（最长边 = 格子的 92%），不变形
            this.fitIconToCell(spriteFrame);
        }
        // 未命中 → 什么都不做，保持预制体上的占位图（兜底）

        // 显示图标
        this.iconSprite.node.active = true;
    }

    /**
     * 播放解锁动画
     * 当格子从 LOCKED 变为 UNLOCKED 时调用
     * 效果：短暂放大再弹回，表示"解锁了"
     */
    public playUnlockAnimation(): void {
        // 【修复】先停止选中弹跳动画并恢复缩放（防止残留放大状态）
        this.stopSelectAnimation();

        // 保存原始缩放值（克隆，防止引用修改）
        const originalScale = this.node.scale.clone();
        // 放大目标值（1.3 倍）
        const bigScale = new Vec3(1.3, 1.3, 1);

        // 使用 tween 创建"弹跳"效果
        tween(this.node)
            // 第一步：在 0.15 秒内放大到 1.3 倍
            .to(0.15, { scale: bigScale }, { easing: 'sineOut' })
            // 第二步：在 0.2 秒内恢复原始大小（弹性缓动）
            .to(0.2, { scale: originalScale }, { easing: 'elasticOut' })
            // 启动动画
            .start();
    }

    /**
     * 【需求】创建/获取选中高亮边框节点（Graphics 金色边框）
     * 图案充满格子后背景被遮挡，选中状态用边框提示；
     * 边框线宽 = 格子边长的 1/10（加粗醒目）
     */
    private ensureSelectBorder(): Node {
        if (!this._selectBorderNode) {
            const node = new Node('SelectBorder');
            node.setParent(this.node);
            const g = node.addComponent(Graphics);
            g.lineWidth = Math.max(4, this._cellSize * 0.1);   // 线宽占格子 1/10
            g.strokeColor = new Color(255, 60, 60, 255);       // 【需求】红色高亮
            const half = this._cellSize / 2;
            g.rect(-half, -half, this._cellSize, this._cellSize);
            g.stroke();
            node.active = false;
            this._selectBorderNode = node;
        }
        return this._selectBorderNode;
    }

    /**
     * 【需求】提示高光：显示金色高亮边框（配合闪烁动画，提示道具使用）
     */
    public playHintHighlight(): void {
        if (!this._hintBorderNode) {
            const node = new Node('HintBorder');
            node.setParent(this.node);
            const g = node.addComponent(Graphics);
            g.lineWidth = Math.max(4, this._cellSize * 0.08);
            g.strokeColor = new Color(255, 230, 80, 255);   // 金色
            const half = this._cellSize / 2;
            g.rect(-half, -half, this._cellSize, this._cellSize);
            g.stroke();
            node.active = false;
            this._hintBorderNode = node;
        }
        this._hintBorderNode.active = true;
    }

    /**
     * 【需求】隐藏提示高光边框
     */
    public stopHintHighlight(): void {
        if (this._hintBorderNode) {
            this._hintBorderNode.active = false;
        }
    }

    /**
     * 【需求】选中提示动画
     * 格子被玩家选中时播放"放大弹回"弹跳效果，突出选中反馈
     */
    public playSelectAnimation(): void {
        // 【修复】先停止可能残留的旧选中动画（防止叠加导致"变大未变回"）
        this.stopSelectAnimation();

        // 保存原始缩放（克隆，防止引用修改）
        const originalScale = this.node.scale.clone();
        // 放大目标值（1.2 倍）
        const bigScale = new Vec3(1.2, 1.2, 1);

        this._selectTween = tween(this.node)
            .to(0.1, { scale: bigScale }, { easing: 'sineOut' })   // 放大
            .to(0.15, { scale: originalScale }, { easing: 'elasticOut' })  // 弹回
            .call(() => { this._selectTween = null; })
            .start();
    }

    /**
     * 【修复】停止选中弹跳动画并恢复原始缩放
     * 消除/解锁等动画前调用，防止选中动画残留导致格子一直处于放大状态
     */
    private stopSelectAnimation(): void {
        if (this._selectTween) {
            this._selectTween.stop();
            this._selectTween = null;
        }
        this.node.setScale(1, 1, 1);
    }

    // ==================== 私有方法：状态视觉表现 ====================

        /**
     * 显示锁定状态
     * - 背景为深灰蓝
     * - 【修改】图标照常显示，但叠加灰色 + 半透明
     *   （相当于在图案上盖了一层灰色透明的布）
     */
    private showLocked(): void {
        // 激活节点
        this.node.active = true;

        // 设置背景颜色为深灰蓝
        if (this.bgSprite) {
            this.bgSprite.color = new Color(15, 52, 96, 180);
        }

        // 【修改】显示图案，但压成灰色半透明
        if (this.iconSprite) {
            this.iconSprite.node.active = true;        // 图案显示出来
            this.applyIconTexture();                    // 应用真实贴图
            // 灰色(130,130,130) + 半透明(170)：蒙灰布效果
            this.iconSprite.color = new Color(130, 130, 130, 170);
        }

        // 【需求】隐藏选中高亮边框（锁定格子不可能是选中态，保险）
        if (this._selectBorderNode) this._selectBorderNode.active = false;
    }

    /**
     * 显示解锁状态（正常可点击状态）
     */
    private showUnlocked(): void {
        // 激活节点
        this.node.active = true;

        // 设置背景为深蓝
        if (this.bgSprite) {
            this.bgSprite.color = new Color(22, 33, 62, 255);
        }

        // 显示图标
        if (this.iconSprite) {
            this.iconSprite.node.active = true;
            this.applyIconTexture();
            // 【修改】恢复全彩不透明（白色 = 不改变原图颜色）
            this.iconSprite.color = new Color(255, 255, 255, 255);
        }

        // 【需求】取消选中时隐藏高亮边框
        if (this._selectBorderNode) this._selectBorderNode.active = false;
    }

    /**
     * 显示选中状态
     */
    private showSelected(): void {
        // 激活节点
        this.node.active = true;

        // 设置背景为玫红
        if (this.bgSprite) {
            this.bgSprite.color = new Color(233, 69, 96, 255);
        }

        // 图标保持显示
        if (this.iconSprite) {
            this.iconSprite.node.active = true;
            this.applyIconTexture();
            // 【修改】恢复全彩不透明
            this.iconSprite.color = new Color(255, 255, 255, 255);
        }

        // 【需求】选中高亮边框（图案充满格子后背景被遮挡，用金色边框提示选中）
        this.ensureSelectBorder().active = true;
    }

    /**
     * 显示消除动画中状态
     * - 背景变金色
     * - 播放缩小消失动画
     */
    private showRemoving(): void {
        // 激活节点
        this.node.active = true;

        // 设置背景为金黄（RGBA: 245,197,24,255）
        if (this.bgSprite) {
            this.bgSprite.color = new Color(245, 197, 24, 255);
        }

        // 播放缩小消失动画
        this.playRemoveAnimation();
    }

    /**
     * 显示空白状态
     * - 完全隐藏节点
     */
    private showEmpty(): void {
        // 直接隐藏整个节点
        this.node.active = false;
    }

    // ==================== 动画相关 ====================

    /**
     * 播放消除动画
     * 使用 Cocos 的 Tween 系统实现缩小消失效果
     * 动画完成后：
     *   1. 将格子数据设为 EMPTY + iconType 清零
     *   2. 隐藏节点
     *   3. 【新增】调用 onRemoved 回调通知 GameManager
     */
    private playRemoveAnimation(): void {
        // 【修复】先停止选中弹跳动画并恢复缩放（防止残留放大状态）
        this.stopSelectAnimation();

        // 消除时先停止提示闪烁动画，
        // 防止闪烁 tween 和消除 tween 同时操作产生冲突
        this.stopHintAnimation();
        // 动画持续时间（秒）
        const duration = 0.3;
        // 目标缩放值（缩小到 0，即消失）
        const targetScale = new Vec3(0, 0, 1);

        // 使用 tween 链式调用创建动画
        tween(this.node)
            // 第一步：延迟 0.05 秒（给玩家看到金色闪烁效果）
            .delay(0.05)
            // 第二步：在 0.25 秒内缩放到 0
            .to(duration - 0.05, { scale: targetScale }, { easing: 'backIn' })
            // 第三步：动画完成后执行回调
            .call(() => {
                // 更新数据状态：变空白 + 图标清零
                if (this._cellData) {
                    this._cellData.state = CellState.EMPTY;
                    this._cellData.iconType = 0;  // 【新增】图标类型清零，保持数据一致
                }
                // 刷新视图（会执行 showEmpty，隐藏节点）
                this.refreshView();

                // 【新增】通知外部"消除动画完成"
                if (this._onRemovedCallback) {
                    this._onRemovedCallback();
                }
            })
            // 启动动画
            .start();
    }

    /**
     * 【新增】播放抖动动画
     * 玩家点击锁定格子时的反馈：左右快速晃动
     */
    public playShakeAnimation(): void {
        // 导入 tween 模块
        //const { tween } = require('cc');

        // 保存原始位置（克隆）
        const origPos = this.node.position.clone();
        // 抖动幅度（像素）
        const amplitude = 5;

        // 左右抖动：左→右→左→回原位
        tween(this.node)
            // 第一次：向左移 5 像素（0.05 秒）
            .to(0.05, { position: new Vec3(origPos.x - amplitude, origPos.y, origPos.z) })
            // 第二次：向右移 5 像素
            .to(0.05, { position: new Vec3(origPos.x + amplitude, origPos.y, origPos.z) })
            // 第三次：再向左移 5 像素
            .to(0.05, { position: new Vec3(origPos.x - amplitude, origPos.y, origPos.z) })
            // 第四次：回到原始位置
            .to(0.05, { position: origPos })
            // 启动
            .start();
    }

        // ==================== 提示动画（第四阶段新增） ====================

    /**
     * 【第四阶段新增】播放提示高亮动画
     * 被"提示"道具选中的格子会金色闪烁，引导玩家点击
     * 
     * 实现原理：
     *   - 用 tween 让背景 Sprite 的颜色在"金色 ↔ 原色"之间交替
     *   - 交替一个来回算一次闪烁，重复 N 次后自动停止
     *   - 动画结束时刷新视图，确保恢复正确的状态颜色
     * 
     * @param duration 动画总时长（秒），默认取 GameConfig.HINT_DURATION
     */
    public playHintAnimation(duration: number = GameConfig.HINT_DURATION): void {
        // 先停止可能存在的旧动画，防止两个 tween 打架
        this.stopHintAnimation();

        // 没有背景精灵则无法闪烁，直接返回
        if (!this.bgSprite) return;

        // 保存原始颜色（动画结束后要恢复）
        const origColor = this.bgSprite.color.clone();
        // 闪烁目标颜色：金黄（和消除动画同色系）
        const flashColor = new Color(245, 197, 24, 255);

        // 半个闪烁周期的时长（秒）：闪过去 0.25 秒 + 闪回来 0.25 秒 = 一次闪烁
        const halfCycle = 0.25;
        // 计算闪烁次数：总时长 ÷ 单次闪烁时长（至少闪 1 次）
        const repeatCount = Math.max(1, Math.floor(duration / (halfCycle * 2)));

        // 创建闪烁动画
        this._hintTween = tween(this.bgSprite)
            // repeat 内嵌一个"变金→变回"的循环动画
            .repeat(
                repeatCount,   // 重复次数
                tween()        // 内嵌动画（无目标节点，仅作为循环体）
                    .to(halfCycle, { color: flashColor })  // 前半拍：变金色
                    .to(halfCycle, { color: origColor }),  // 后半拍：恢复原色
            )
            // 全部闪完后执行收尾
            .call(() => {
                // 清空句柄
                this._hintTween = null;
                // 刷新视图，确保背景色与当前状态一致
                // （例如动画期间格子被选中了，结束时应该显示选中色）
                this.refreshView();
            })
            // 启动动画
            .start();
    }

    /**
     * 【第四阶段新增】停止提示闪烁动画
     * 触发时机：
     *   - 玩家点了被提示的格子（选中状态覆盖提示）
     *   - 玩家消除了被提示的格子
     *   - 新的提示开始前清除旧提示
     */
    public stopHintAnimation(): void {
        // 有动画在播才需要停止
        if (this._hintTween) {
            // 停止 tween（会打断动画，停留在当前帧）
            this._hintTween.stop();
            // 清空句柄
            this._hintTween = null;
        }
    }
}