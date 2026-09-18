// ============================================================
// assets/scripts/data/GlobalData.ts
// 全局数据（静态类）
// 用途：场景之间传递数据
//   Cocos 的 director.loadScene 不能直接传参数，
//   所以用这个静态类暂存"玩家选择了哪一关"，
//   Game 场景加载后从这里读取
// ============================================================

export class GlobalData {

    /**
     * 玩家当前选择要玩的关卡ID
     * - Menu 点击"开始游戏"时写入当前进度关卡
     * - DevPanel 选择关卡时写入
     * - GameManager 启动时读取
     * - "下一关"时 +1 再重载 Game 场景
     */
    static currentLevelId: number = 1;
}