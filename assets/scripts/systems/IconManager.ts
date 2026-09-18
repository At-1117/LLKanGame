// ============================================================
// assets/scripts/systems/IconManager.ts   【完整新版·编辑器拖拽方案】
// 图案贴图管理器（静态类）
// 
// 本次改动：彻底放弃 resources.load 动态加载，
// 改为"编辑器拖拽注册"模式：
//   GameManager 在编辑器里把 18 张图拖进 iconFrames 数组，
//   开局时调用 registerIcons 把数组注册进来，
//   Cell 通过 getIcon(iconType) 取贴图。
// 
// 数组顺序约定：数组下标 0 = iconType 1，下标 1 = iconType 2 ... 下标 17 = iconType 18
// ============================================================

import { SpriteFrame } from 'cc';
import { Logger } from '../utils/Logger';

export class IconManager {

    // ==================== 私有属性 ====================

    /** 注册表：iconType → SpriteFrame */
    private static _cache: Map<number, SpriteFrame> = new Map();

    // ==================== 公开方法 ====================

    /**
     * 注册图案贴图列表（开局时由 GameManager 调用）
     * 
     * @param frames 在编辑器里拖入的图案数组
     *               下标 0 对应 iconType=1，下标 1 对应 iconType=2，以此类推
     */
    public static registerIcons(frames: SpriteFrame[]): void {
        // 清空旧数据（重新开局的关卡可能图案数不同）
        this._cache.clear();

        // 遍历数组，把每张贴图按"下标+1"作为 iconType 注册
        frames.forEach((frame, index) => {
            // 跳过空位
            if (frame) {
                this._cache.set(index + 1, frame);
            }
        });

        Logger.log(`IconManager.registerIcons: 已注册 ${this._cache.size} 个图案贴图`);
    }

    /**
     * 获取图案贴图
     * @param iconType 图案类型编号（1~18）
     * @returns SpriteFrame；未注册返回 null（Cell 会保持占位图兜底）
     */
    public static getIcon(iconType: number): SpriteFrame | null {
        return this._cache.get(iconType) ?? null;
    }
}