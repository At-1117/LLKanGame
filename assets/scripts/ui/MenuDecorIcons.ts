// ============================================================
// assets/scripts/ui/MenuDecorIcons.ts   【完整新版·到处飘】
// 主菜单装饰图标组件
// 功能：18 个棋盘图案随机分布在屏幕内，
//       每个图案持续随机飘动（飘到随机目标点→再飘下一个，无限循环）
// ============================================================

import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Vec3, tween } from 'cc';
import { Logger } from '../utils/Logger';

const { ccclass, property } = _decorator;

@ccclass('MenuDecorIcons')
export class MenuDecorIcons extends Component {

    // ==================== 编辑器暴露属性 ====================

    /** 18 个装饰图案（下标 0 = 图案类型 1） */
    @property({ type: [SpriteFrame], tooltip: '18个装饰图案（按顺序拖入）' })
    private iconFrames: SpriteFrame[] = [];

    /** 装饰图标容器（不拖则用组件所在节点） */
    @property({ type: Node, tooltip: '装饰图标容器节点' })
    private decorLayer: Node | null = null;

    /** 图标边长（像素） */
    @property({ tooltip: '装饰图标边长（像素）' })
    private iconSize: number = 72;

    // ==================== 飘动范围常量（留边距，图标不跑出屏幕） ====================

    /** X 方向范围：-330 ~ 330（屏幕半宽 375 留 45 边距） */
    private static readonly RANGE_X = 330;

    /** Y 方向范围：-600 ~ 600（屏幕半高 667 留 67 边距） */
    private static readonly RANGE_Y = 600;

    // ==================== 生命周期 ====================

    onLoad(): void {
        // 【需求】取消 Menu 界面装饰图案（不再生成飘动图标，界面更简洁干净）
        Logger.log('MenuDecorIcons: 装饰图案已取消（不再生成飘动图标）');
        return;

        // 容器兜底
        if (!this.decorLayer) this.decorLayer = this.node;

        // 生成 18 个飘动图标
        this.createDecorIcons();
    }

    // ==================== 私有方法 ====================

    /**
     * 创建 18 个装饰图标：随机初始位置 + 无限随机飘动
     */
    private createDecorIcons(): void {
        if (!this.decorLayer) return;

        for (let i = 0; i < this.iconFrames.length; i++) {
            // 取图案贴图
            const frame = this.iconFrames[i];
            if (!frame) continue;

            // 创建节点，随机初始位置
            const node = new Node(`DecorIcon_${i + 1}`);
            node.setParent(this.decorLayer);
            node.setPosition(this.randomPosition());

            // 尺寸：先按原图宽高比等比缩放（不再强制正方形）
            const uiTransform = node.addComponent(UITransform);
            this.fitSizeToFrame(uiTransform, frame);

            // 贴图
            const sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = frame;

            // 播放飘动动画
            this.playDriftAnimation(node);
        }

        Logger.log(`MenuDecorIcons: 已创建 ${this.iconFrames.length} 个飘动装饰图标`);
    }

    /**
     * "到处飘"动画
     * 每次随机选一个屏幕内的目标点，3~6 秒平滑飘过去，
     * 到达后再随机下一个目标，无限循环
     */
    private playDriftAnimation(node: Node): void {
        // 定义一次"飘向随机目标"的行为
        const wander = () => {
            // 随机目标位置
            const target = this.randomPosition();
            // 随机飘动时长（3~6 秒）
            const duration = 3 + Math.random() * 3;

            tween(node)
                .to(duration, { position: target }, { easing: 'sineInOut' })
                .call(wander)   // 到达后递归调用，开始下一次飘动
                .start();
        };

        // 启动
        wander();
    }
    
    /**
     * 按原图宽高比等比缩放节点尺寸
     * 规则：最长边 = iconSize，另一边按原图比例缩放，保证不变形
     * @param uiTransform 目标节点的 UITransform
     * @param frame 图案的 SpriteFrame
     */
    private fitSizeToFrame(uiTransform: UITransform, frame: SpriteFrame): void {
        try {
            const original = frame.originalSize;
            if (!original || original.width <= 0 || original.height <= 0) {
                uiTransform.setContentSize(this.iconSize, this.iconSize);
                return;
            }
            const scale = this.iconSize / Math.max(original.width, original.height);
            uiTransform.setContentSize(original.width * scale, original.height * scale);
        } catch (err) {
            uiTransform.setContentSize(this.iconSize, this.iconSize);
            Logger.warn('MenuDecorIcons.fitSizeToFrame: 缩放失败', err);
        }
    }

    /**
     * 生成屏幕内的随机位置（范围内均匀随机）
     */
    private randomPosition(): Vec3 {
        const x = (Math.random() - 0.5) * (MenuDecorIcons.RANGE_X * 2);
        const y = (Math.random() - 0.5) * (MenuDecorIcons.RANGE_Y * 2);
        return new Vec3(x, y, 0);
    }
}