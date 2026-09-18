# HANDOFF —— 连连看小游戏（LLKanGame）代码检查与发布前交接

> 生成：2026-09-04（Codex）
> 来源：DeepSeek Harness 会话「检查连连看小游戏代码问题」（Edge 标签页 http://127.0.0.1:3080/ ）——该会话内同一请求连续 3 次执行失败（`registration.adapter.prepareCall is not a function`，Harness 工具层故障），故转由 Codex 生成本文档。
> 工程：E:/Project/LLKanGame · Cocos Creator 3.8.8 · **无 git 仓库**（无版本历史，改动前务必先备份）
> 标注约定：【已核实】= 本次已对照磁盘文件确认；【会话记录】= 来自 Harness 会话、未经本次复核，接手时请再确认。

---

## 1. 任务（Task）

对 Cocos Creator 连连看小游戏做「代码问题检查 → 修复 → 发布前审查」，当前阶段目标为**产出可交接的发布前状态与后续行动清单**（即本文档）。

会话内已完成修复（代码层面全部【已核实】落地，脚本最后改动 2026-08-22）：

| # | 问题 | 修复位置 |
|---|------|----------|
| 1 | 设置界面第一次打开要点两次 | assets/scripts/ui/SettingsDialog.ts：删除 onLoad 里的“初始隐藏”逻辑（隐藏态改由场景文件 + hide() 保证） |
| 2 | 胜利/失败弹窗外面多出“返回首页”按钮 | assets/scenes/Game.scene：BtnHome 移回 SettingsPanel 子节点（随设置面板显隐） |
| 3 | 胜利/失败弹窗背景要 45° 圆角 | ResultDialog.ts 新增 ensureRoundedMask()（约 L218），activateDialog() 调用；场景里 ResultPanel 背景 Sprite 移到子节点 Bg |
| 4 | 解锁道具（技能）音效不响 | assets/scripts/ui/GameHUD.ts：删除重复的 onSkillClicked（原 L290 无音效版本覆盖了 L185 带音效版本）；新 btnskill.mp3 本身有效（Cocos 已解码，1.02s） |
| 5 | 进入 Game 界面 BGM 自动降到 50% | AudioSystem.setBgmVolume()（约 L332）；GameManager.start() → 0.5；MainMenuUI.start() → 1.0 |
| 6 | 关闭调试日志 | assets/scripts/utils/Logger.ts L8：enabled = false |

当前子任务：生成本文档（已完成）。

---

## 2. 进度（Progress）

### 已核实（本次对照磁盘 2026-09-04）
- Logger.ts L8 enabled = false ✓
- GameHUD.ts 只剩一个 onSkillClicked（L185，内含 AudioSystem.playSkillSound() L187）✓
- AudioSystem.setBgmVolume 已实现；GameManager.ts L176 调 0.5、MainMenuUI.ts L112 调 1.0 ✓
- ResultDialog.ts / SettingsDialog.ts 均含 ensureRoundedMask() ✓
- SettingsDialog.onLoad 不再隐藏自身；ResultDialog.onLoad L57 的 node.active = false **是有意保留**（见避坑点 4）✓
- Game.scene 结构（JSON 解析核对）：PopupLayer(active=false) → ResultPanel(active=true) 下挂 Bg；SettingsPanel(active=false) 下挂 BtnHome + Bg ✓
- 发布前体检结论【会话记录】：无阻断发布的代码 bug；设计分辨率 750×1334 fitHeight、10 关配置、18 套图案/音效一一对应、场景脚本组件引用等均通过。

### 待办/未落地（详见第 3、4 节）
- 广告 ID 仍是占位符（GameConfig.ts L58-59：your_video_placement_id / your_interstitial_id）
- “加爱心”为临时实现（MainMenuUI.ts L171-178：直接 +1，TODO 标注后续换激励视频）
- Menu.scene 中 BtnDev 节点**当前仍 active=true**（见卡点 3，与会话说法矛盾）
- 抖音资质/提审/广告位流程未走（用户侧）

---

## 3. 卡点（Blockers）

1. **广告位 ID 拿不到（依赖上线）**：抖音流量主/激励视频广告位需小游戏**审核通过并正式发布后**才能开通。代码不需要等 ID（tt.createRewardedVideoAd({ adUnitId }) 是运行时字符串），可先用占位 pending 写好封装，拿到真实 ID 只改 GameConfig 两行。【会话记录】
2. **BtnDev 隐藏存疑（重要，已核实磁盘状态）**：会话中用户称“BtnDev 我已隐藏”，但 **assets/scenes/Menu.scene（2026-08-25 20:40 保存）中 BtnDev 节点 _active 仍为 true**。高度怀疑是被编辑器旧版本覆盖（见避坑点 1）。**上线前必须再次确认/执行隐藏。**
3. **产品决策未定**：道具用尽后是否给获取途径（当前“道具用尽”提示已隐藏、点击无反馈）；加爱心是否接激励视频——发布前需拍板。
4. **抖音发布资质/流程未启动（用户侧）**：软著（如需）、ICP/游戏备案、开放平台实名、创建小游戏、构建抖音包、上传提审。
5. **Harness 工具故障**：registration.adapter.prepareCall is not a function 导致原会话无法继续执行代码类任务（本文件已由 Codex 代出；后续如需 AI 改代码，建议先在 Codex/新会话验证 Harness 是否恢复）。

---

## 4. 下一步（Next Steps）

### 代码侧（可代办）
1. 编写抖音激励视频广告封装（RewardedAdManager：tt.createRewardedVideoAd + 失败重试 + 加爱心/道具奖励回调），GameConfig.AD_VIDEO_ID 暂填 pending；等真实 ID 下来只改一行配置。
2. 隐藏 BtnDev：在 Cocos 编辑器里取消激活该节点并 Ctrl+S（或改场景 JSON _active=false），保存后**重新核对**。
3. （低优先级/可选）清理：删除无代码引用的 match.mp3（约 64KB）；assets/res 与 assets/resources 去重瘦身（勿删场景 uuid 引用的贴图）；BoardView 对象池优化；Logger 构建开关。
4. Cocos Creator 3.8.8 构建抖音小游戏包（需先装抖音构建插件），确认构建面板无调试输出。

### 用户侧（按顺序，资质最耗时先启动）【会话记录】
5. 软著申请（最久，立即启动）→ 抖音开放平台注册 + 实名 → 创建小游戏 + 绑定主体 → 构建抖音包 → 上传提审（隐私合规需声明广告 SDK）→ 上线 → 开通流量主 → 创建激励视频广告位 → 拿真实 ID 替换 → 重新构建发布。
6. 会话最后遗留的选项 A/B/C 未选择：A 写广告封装 / B 检查抖音构建插件是否就绪 / C 其他——接手时先确认用户意图。

---

## 5. 避坑点（Pitfalls）

1. **Cocos 编辑器弹出“检测到外部修改”，务必选「重新加载 / Reload」，绝不要选「保留编辑器版本」**。场景文件被外部脚本直接改过（Game.scene 等），选错会用编辑器内存里的旧版本覆盖磁盘修复——BtnDev 恢复成 active=true 极可能就是这么来的。打开后按 Ctrl+S 保存一次固化。
2. **场景文件是单行/紧凑 JSON**：按行 grep、文本编辑器手工改都不可靠（节点名与内容在同一物理行）。改场景用编辑器，或写 JSON 解析脚本；改完校验 _active 与父子关系（_parent/_children 的 __id__）。
3. **TypeScript 类中重复方法定义 = 后者覆盖前者且不报错**：本次技能音效不响的根因。新增方法前先 grep 同名；此类 bug 靠“换资源”永远修不好。
4. **Cocos onLoad 延迟到节点首次激活才执行**：inactive 面板若在 onLoad 里写“隐藏自身”，会导致首次打开“点两次/不显示”（SettingsDialog 的旧 bug）。隐藏态交给场景文件 + hide()。注意 ResultDialog.onLoad L57 的 node.active = false 是**有意保留**（依赖 GameManager.ensurePopupLayerInitialized 在 start 时强制激活 PopupLayer、提前触发 onLoad 后再隐藏），不要当 bug 再删一次。
5. **资源“改了没声音/没生效”先查缓存**：对比源文件与 library/ 缓存的时间戳、.meta 是否重新导入。btnskill 案例：文件有效 + Cocos _duration 正常，真凶是代码重复方法，不是资源。
6. **本工程没有 git**：无回滚手段。做场景大改前先备份文件（或建议先 git init 提交一版基线）。
7. **两套资源目录**：assets/res（编辑器导入原件，场景按 uuid 引用）与 assets/resources（运行时加载副本）内容重叠，会增大包体；清理时只能删“无 uuid 引用”的，否则场景贴图会红。
8. **审核红线**：上线包不能带开发者入口/作弊面板（BtnDev + DevPanel）；广告 SDK 提审时必须声明。
9. Logger.enabled 已关，但属硬编码；正式构建时仍在 Cocos 构建面板确认一遍，避免误开。

---

## 附：关键产物/相关文件
- 代码：assets/scripts/ui/SettingsDialog.ts、assets/scripts/ui/ResultDialog.ts、assets/scripts/ui/GameHUD.ts、assets/scripts/systems/AudioSystem.ts、assets/scripts/core/GameManager.ts、assets/scripts/ui/MainMenuUI.ts、assets/scripts/utils/Logger.ts、assets/scripts/data/GameConfig.ts
- 场景：assets/scenes/Game.scene、assets/scenes/Menu.scene
- 会话原始上下文：DeepSeek Harness 标签「检查连连看小游戏代码问题」（127.0.0.1:3080）
