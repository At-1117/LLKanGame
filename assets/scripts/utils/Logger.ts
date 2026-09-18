import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

//调试日志
@ccclass('Logger')
export class Logger extends Component {
    // 【发布】已关闭调试日志（发布后可置回 true 用于排查）
    private static enabled = false;
    static log(...args: any[]) {
        if (this.enabled) console.log('[LinkGame]', ...args);
    }
    static warn(...args: any[]) {
        if (this.enabled) console.warn('[LinkGame]', ...args);
    }
    static error(...args: any[]) {
        console.error('[LinkGame]', ...args);
    }
}


