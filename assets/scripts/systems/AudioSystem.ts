// ============================================================
// assets/scripts/systems/AudioSystem.ts
// 音频系统（静态类，全游戏通用）
// 
// 【重写版】设计要点：
//   1. 每个音效类型使用【独立音源】（各自独立子节点），杜绝串音/覆盖
//   2. 播放前自动停止同类音源，避免叠加残留
//   3. 按钮音效（btn.mp3 短）自然播完，场景切换不截断
//   4. 道具/技能音效较长，播放其他音效前自动停止
//   5. 胜利/失败音效不受音效开关控制，播放时暂停 BGM
//   6. 格子点击音效池（4 个）轮流播放
// ============================================================

import { Node, AudioSource, AudioClip, director, resources, Button } from 'cc';
import { Logger } from '../utils/Logger';
import { SaveSystem } from './SaveSystem';

export class AudioSystem {

    // ==================== 音源（每个独立子节点） ====================

    /** 常驻根节点 */
    private static _node: Node | null = null;

    /** 格子点击音效池（4 个轮流播放） */
    private static _clickSources: AudioSource[] = [];
    private static _clickIndex: number = 0;

    /** 统一按钮音效源 */
    private static _buttonSource: AudioSource | null = null;

    /** 道具专用音效源 */
    private static _propSource: AudioSource | null = null;

    /** 技能音效源（btnskill 较长，独立音源类似 bgm 播放） */
    private static _skillSource: AudioSource | null = null;

    /** 胜利/失败结算音效源 */
    private static _resultSource: AudioSource | null = null;

    /** 背景音乐源 */
    private static _bgmSource: AudioSource | null = null;

    /** 【需求】背景音乐音量（默认 1.0；进入 Game 界面后由 GameManager 调为 0.5） */
    private static _bgmVolume: number = 1;

    // ==================== 音频缓存 ====================

    /** 格子点击音效缓存：iconType → AudioClip */
    private static _clickClips: Map<number, AudioClip> = new Map();

    /** 统一按钮音效缓存 */
    private static _buttonClip: AudioClip | null = null;

    /** 道具专用音效缓存：propId → AudioClip */
    private static _propClips: Map<string, AudioClip> = new Map();

    /** 胜利音效缓存 */
    private static _victoryClip: AudioClip | null = null;

    /** 失败音效缓存 */
    private static _failClip: AudioClip | null = null;

    /** 背景音乐缓存 */
    private static _bgmClip: AudioClip | null = null;

    // ==================== 配置 ====================

    /** 道具 ID → 专用音效文件路径 */
    private static readonly PROP_SOUND_PATHS: Record<string, string> = {
        hint: 'sounds/btnhint',
        bomb: 'sounds/btnbomb',
        shuffle: 'sounds/btnshuffle',
        skill: 'sounds/btnskill',
    };

    /** 道具按钮节点名（bindButtonSounds 跳过，由 GameHUD 播放专用音效） */
    private static readonly PROP_BUTTON_NAMES = new Set(['BtnHint', 'BtnBomb', 'BtnShuffle', 'BtnSkill']);

    /** 弹窗面板按钮节点名（bindButtonSounds 跳过，由 SettingsDialog/ResultDialog 自行播放按钮音效） */
    private static readonly PANEL_BUTTON_NAMES = new Set([
        'BtnHome', 'BtnRestart', 'BtnClose',
        'BtnNext', 'BtnReplay', 'BtnBack',
    ]);

    // ==================== 初始化 ====================

    public static init(): void {
        if (this._node && this._node.isValid) {
            return;
        }

        // 重置引用（旧节点可能已销毁）
        this._clickSources = [];
        this._clickIndex = 0;
        this._buttonSource = null;
        this._propSource = null;
        this._skillSource = null;
        this._resultSource = null;
        this._bgmSource = null;
        this._node = null;

        // 常驻节点：跨场景存活
        const node = new Node('AudioSystemNode');
        director.addPersistRootNode(node);
        this._node = node;

        // 每个音源挂独立子节点（杜绝同节点多 AudioSource 串音/覆盖）
        const makeSource = (name: string): AudioSource => {
            const srcNode = new Node(name);
            srcNode.setParent(node);
            return srcNode.addComponent(AudioSource);
        };

        for (let i = 0; i < 4; i++) this._clickSources.push(makeSource('ClickSrc' + i));
        this._buttonSource = makeSource('ButtonSrc');
        this._propSource = makeSource('PropSrc');
        this._skillSource = makeSource('SkillSrc');
        this._resultSource = makeSource('ResultSrc');
        this._bgmSource = makeSource('BgmSrc');

        Logger.log('AudioSystem.init: 音频系统初始化完成（独立音源）');
    }

    // ==================== 预加载 ====================

    /**
     * 预加载本关所需音效（点击/按钮/道具/结算音效）
     * @param iconTypes 本关用到的图案类型数组，按需加载点击音效
     */
    public static async preloadSounds(iconTypes: number[]): Promise<void> {
        this.init();
        this._clickClips.clear();

        // 点击音效：click_01, click_02 ...
        const unique = Array.from(new Set(iconTypes));
        for (const iconType of unique) {
            const numStr = iconType < 10 ? `0${iconType}` : `${iconType}`;
            const clip = await this.loadClip(`sounds/click_${numStr}`);
            if (clip) {
                this._clickClips.set(iconType, clip);
            }
        }

        // 统一按钮音效
        this._buttonClip = await this.loadClip('sounds/btn');

        // 道具专用音效
        for (const [propId, path] of Object.entries(this.PROP_SOUND_PATHS)) {
            const clip = await this.loadClip(path);
            if (clip) {
                this._propClips.set(propId, clip);
            }
        }

        // 胜利/失败音效
        this._victoryClip = await this.loadClip('sounds/victory');
        this._failClip = await this.loadClip('sounds/over');
    }

    /** 单独预加载统一按钮音效（主菜单场景调用，只需按钮音效） */
    public static async preloadButtonSound(): Promise<void> {
        this.init();
        this._buttonClip = await this.loadClip('sounds/btn');
    }

    /** 预加载背景音乐 */
    public static async preloadBgm(): Promise<void> {
        this.init();
        this._bgmClip = await this.loadClip('sounds/bgm');
    }

    /** 加载音效文件（失败优雅降级，返回 null 不报错） */
    private static loadClip(path: string): Promise<AudioClip | null> {
        return new Promise<AudioClip | null>((resolve) => {
            resources.load(path, AudioClip, (err, clip) => {
                if (err) {
                    Logger.warn(`AudioSystem.loadClip: 音效加载失败 ${path}（缺失可忽略，将静音）`);
                    resolve(null);
                } else {
                    resolve(clip);
                }
            });
        });
    }

    // ==================== 播放 ====================

    /** 播放格子点击音效（受音效开关控制） */
    public static playClickSound(iconType: number): void {
        if (!SaveSystem.getSettings().soundOn) return;
        const clip = this._clickClips.get(iconType);
        if (!clip || this._clickSources.length === 0) return;

        // 停止上一个点击音效（避免叠加）
        for (const s of this._clickSources) {
            if (s.isValid) s.stop();
        }

        const source = this._clickSources[this._clickIndex];
        this._clickIndex = (this._clickIndex + 1) % this._clickSources.length;
        source.clip = clip;
        source.volume = 1;
        source.play();
    }

    /** 播放统一按钮音效（受音效开关控制） */
    public static playButtonSound(): void {
        if (!SaveSystem.getSettings().soundOn) return;
        if (!this._buttonClip || !this._buttonSource || !this._buttonSource.isValid) return;

        this._buttonSource.stop();
        this._buttonSource.clip = this._buttonClip;
        this._buttonSource.volume = 1;
        this._buttonSource.play();
    }

    /** 播放道具专用音效（受音效开关控制；播放前停结算音效防残留） */
    public static playPropSound(propId: string): void {
        if (!SaveSystem.getSettings().soundOn) return;
        this.stopResultSound();

        const clip = this._propClips.get(propId);
        if (!clip || !this._propSource || !this._propSource.isValid) return;

        this._propSource.stop();
        this._propSource.clip = clip;
        this._propSource.volume = 1;
        this._propSource.play();
    }

    /** 播放技能专用音效（独立音源，长音效类似 bgm 播放；受音效开关控制） */
    public static playSkillSound(): void {
        if (!SaveSystem.getSettings().soundOn) return;
        this.stopResultSound();

        const clip = this._propClips.get('skill');
        if (!clip || !this._skillSource || !this._skillSource.isValid) return;

        this._skillSource.stop();
        this._skillSource.clip = clip;
        this._skillSource.volume = 1;
        this._skillSource.play();
    }

    /** 播放胜利音效（不受音效开关控制；播放时暂停 BGM，离开结算页后由 refreshBgm 恢复） */
    public static playVictorySound(): void {
        if (!this._victoryClip || !this._resultSource || !this._resultSource.isValid) return;
        this.pauseBgm();
        this._resultSource.stop();
        this._resultSource.clip = this._victoryClip;
        this._resultSource.volume = 1;
        this._resultSource.play();
    }

    /** 播放失败音效（不受音效开关控制；播放时暂停 BGM） */
    public static playFailSound(): void {
        if (!this._failClip || !this._resultSource || !this._resultSource.isValid) return;
        this.pauseBgm();
        this._resultSource.stop();
        this._resultSource.clip = this._failClip;
        this._resultSource.volume = 1;
        this._resultSource.play();
    }

    // ==================== 停止 ====================

    /**
     * 停止所有短音效（格子点击/按钮/道具/技能/结算）
     * 场景切换或关闭音效时调用
     * （场景切换延迟 0.5s 已保证按钮音效播完，这里清理不会造成按钮无声）
     */
    public static stopAllClickSounds(): void {
        for (const source of this._clickSources) {
            if (source && source.isValid) {
                source.volume = 0;
                source.stop();
            }
        }
        if (this._buttonSource && this._buttonSource.isValid) {
            this._buttonSource.volume = 0;
            this._buttonSource.stop();
        }
        this.stopPropSound();
        this.stopSkillSound();
        this.stopResultSound();
    }

    /** 停止道具音效 */
    public static stopPropSound(): void {
        if (this._propSource && this._propSource.isValid) {
            this._propSource.stop();
        }
    }

    /** 停止技能音效 */
    public static stopSkillSound(): void {
        if (this._skillSource && this._skillSource.isValid) {
            this._skillSource.stop();
        }
    }

    /** 停止胜利/失败结算音效 */
    public static stopResultSound(): void {
        if (this._resultSource && this._resultSource.isValid) {
            this._resultSource.stop();
        }
    }

    // ==================== 背景音乐 ====================

    /** 开始播放背景音乐（循环，受音乐开关控制） */
    public static startBgm(): void {
        if (!SaveSystem.getSettings().musicOn) return;
        if (!this._bgmClip || !this._bgmSource || !this._bgmSource.isValid) return;
        if (this._bgmSource.playing) {
            // 【需求】已播放时也同步音量（进入 Game 界面调小、回 Menu 恢复）
            this._bgmSource.volume = this._bgmVolume;
            return;
        }

        this._bgmSource.clip = this._bgmClip;
        this._bgmSource.loop = true;
        this._bgmSource.volume = this._bgmVolume;
        this._bgmSource.play();
    }

    /**
     * 【需求】设置背景音乐音量（0~1）
     * @param volume 目标音量（Game 界面 0.5，Menu 界面恢复 1）
     */
    public static setBgmVolume(volume: number): void {
        this._bgmVolume = Math.max(0, Math.min(1, volume));
        if (this._bgmSource && this._bgmSource.isValid && this._bgmSource.playing) {
            this._bgmSource.volume = this._bgmVolume;
        }
        Logger.log(`AudioSystem.setBgmVolume: 背景音乐音量设置为 ${this._bgmVolume}`);
    }

    /** 停止背景音乐 */
    public static stopBgm(): void {
        if (this._bgmSource && this._bgmSource.isValid) {
            this._bgmSource.volume = 0;
            this._bgmSource.stop();
        }
    }

    /** 暂停背景音乐（结算音效播放时调用；场景切换后 refreshBgm 恢复） */
    public static pauseBgm(): void {
        if (this._bgmSource && this._bgmSource.playing) {
            this._bgmSource.pause();
        }
    }

    /** 按当前设置刷新背景音乐状态（开关变化/进入场景时调用） */
    public static refreshBgm(): void {
        if (SaveSystem.getSettings().musicOn) {
            this.startBgm();
        } else {
            this.stopBgm();
        }
    }

    // ==================== 按钮音效绑定 ====================

    /**
     * 给节点下所有 Button 自动绑定统一按钮音效
     * 道具按钮（BtnHint/BtnBomb/BtnShuffle/BtnSkill）跳过，由 GameHUD 播放各自专用音效
     * @param root 根节点（传 Canvas）
     */
    public static bindButtonSounds(root: Node): void {
        const buttons = root.getComponentsInChildren(Button);
        for (const btn of buttons) {
            const nodeAny = btn.node as any;
            // 防止重复绑定
            if (nodeAny.__btnSoundBound) continue;
            nodeAny.__btnSoundBound = true;

            // 道具按钮跳过统一按钮音效（有专属音效）
            if (this.PROP_BUTTON_NAMES.has(btn.node.name)) {
                continue;
            }

            // 弹窗面板按钮跳过（由 SettingsDialog/ResultDialog 自行播放，避免与回调冲突）
            if (this.PANEL_BUTTON_NAMES.has(btn.node.name)) {
                continue;
            }

            btn.node.on(Button.EventType.CLICK, () => {
                // 先停止结算/道具音效残留，防止代替/叠加按钮音效
                AudioSystem.stopResultSound();
                AudioSystem.stopPropSound();
                AudioSystem.playButtonSound();
            });
        }
    }
}
