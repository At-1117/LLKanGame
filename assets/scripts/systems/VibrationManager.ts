// ============================================================
// assets/scripts/systems/VibrationManager.ts
// 震动管理器（静态类）
// 支持抖音小游戏震动 API；浏览器预览无 API 时静默跳过
// （视觉抖动由 Cell 的 playShakeAnimation 负责，两者配合）
// ============================================================

import { SaveSystem } from './SaveSystem';

export class VibrationManager {

    /**
     * 触发一次震动（受设置开关控制）
     */
    public static vibrate(): void {
        // 震动开关关闭 → 不震
        if (!SaveSystem.getSettings().vibrationOn) return;

        // 获取抖音小游戏全局对象
        // 浏览器预览环境没有 tt，安全跳过
        const ttApi = (globalThis as any).tt;
        if (ttApi && typeof ttApi.vibrateShort === 'function') {
            try {
                // 抖音震动 API：轻震动
                ttApi.vibrateShort({ type: 'light' });
            } catch (err) {
                // 震动失败不报错，静默忽略
            }
        }
    }
}