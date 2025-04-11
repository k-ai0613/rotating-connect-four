import { SoundEffect, SoundTheme } from '@/types';

// 固定の効果音（拡張子ごとのパスを用意）
const FIXED_SOUNDS = {
  draw: ['/sounds/default/draw.mp3'],
  win: ['/sounds/default/win.mp3'],
  reset: ['/sounds/default/reset.mp3']
};

// デフォルトの効果音設定
export const DEFAULT_SOUND_THEME: SoundTheme = {
  name: 'custom',
  effects: {
    placement: '/sounds/default/placement.mp3',
    rotation: '/sounds/default/rotation.mp3',
    win: FIXED_SOUNDS.win[0],
    draw: FIXED_SOUNDS.draw[0],
    reset: FIXED_SOUNDS.reset[0]
  }
};

// 効果音テーマ（カスタム1つのみ）
export const SOUND_THEMES: SoundTheme[] = [
  DEFAULT_SOUND_THEME
];

// AudioContextを遅延初期化するための変数
let audioContext: AudioContext | null = null;

// 効果音をロードして再生するクラス
class SoundPlayer {
  private audioCache: Map<string, AudioBuffer> = new Map();
  private enabled: boolean = true;
  private currentTheme: SoundTheme = DEFAULT_SOUND_THEME;
  private failedSounds: Set<string> = new Set();
  
  constructor() {
    // ローカルストレージからカスタムテーマを読み込む（クライアントサイドでのみ実行）
    if (typeof window !== 'undefined') {
      this.loadCustomSoundSettings();
    }
  }
  
  // ローカルストレージからカスタムサウンド設定を読み込む
  private loadCustomSoundSettings(): void {
    try {
      const savedSettings = localStorage.getItem('customSoundSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        
        // 固定サウンドは上書きされないようにする
        this.currentTheme = {
          name: 'custom',
          effects: {
            ...parsedSettings.effects,
            win: FIXED_SOUNDS.win[0],
            draw: FIXED_SOUNDS.draw[0],
            reset: FIXED_SOUNDS.reset[0]
          }
        };
        
        // SOUND_THEMESも更新（参照用）
        SOUND_THEMES[0] = this.currentTheme;
      }
    } catch (error) {
      console.error('カスタムサウンド設定の読み込みに失敗しました:', error);
    }
  }
  
  // カスタムサウンド設定を保存
  public saveCustomSoundSettings(effects: Partial<SoundEffect>): void {
    try {
      // 固定サウンドは上書きされないようにする
      const newEffects = {
        ...this.currentTheme.effects,
        ...effects,
        win: FIXED_SOUNDS.win[0], 
        draw: FIXED_SOUNDS.draw[0], 
        reset: FIXED_SOUNDS.reset[0]
      };
      
      // 新しい設定を適用
      this.currentTheme = {
        name: 'custom',
        effects: newEffects
      };
      
      // ローカルストレージに保存
      localStorage.setItem('customSoundSettings', JSON.stringify({
        effects: newEffects
      }));
      
      // SOUND_THEMESも更新（参照用）
      SOUND_THEMES[0] = this.currentTheme;
      
      // 失敗したサウンドリストをクリア（設定が変わった可能性があるため）
      this.failedSounds.clear();
    } catch (error) {
      console.error('カスタムサウンド設定の保存に失敗しました:', error);
    }
  }
  
  // AudioContextの初期化
  private initAudioContext(): AudioContext {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
  }
  
  // AudioBufferをロード
  private async loadSound(url: string): Promise<AudioBuffer | null> {
    if (this.audioCache.has(url)) {
      return this.audioCache.get(url)!;
    }
    
    if (this.failedSounds.has(url)) {
      return null;
    }
    
    try {
      const context = this.initAudioContext();
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      try {
        const audioBuffer = await context.decodeAudioData(arrayBuffer);
        this.audioCache.set(url, audioBuffer);
        return audioBuffer;
      } catch (decodeError) {
        console.error('音声デコードエラー:', url, decodeError);
        this.failedSounds.add(url);
        
        // デフォルトの音に戻す
        const effectType = Object.entries(this.currentTheme.effects)
          .find(([_, path]) => path === url)?.[0] as keyof SoundEffect | undefined;
        
        if (effectType && DEFAULT_SOUND_THEME.effects[effectType]) {
          return this.loadSound(DEFAULT_SOUND_THEME.effects[effectType]);
        }
        
        return null;
      }
    } catch (error) {
      console.error('音声の読み込みに失敗:', url, error);
      this.failedSounds.add(url);
      return null;
    }
  }
  
  // 効果音を再生
  public async play(effectType: keyof SoundEffect): Promise<void> {
    if (!this.enabled) return;
    
    try {
      const soundUrl = this.currentTheme.effects[effectType];
      
      // 固定サウンドの場合、配列から適切なファイルを試す
      let audioBuffer: AudioBuffer | null = null;
      
      if (['win', 'draw', 'reset'].includes(effectType)) {
        // 固定サウンドは複数の形式を順番に試す
        const soundUrls = FIXED_SOUNDS[effectType as 'win' | 'draw' | 'reset'];
        
        for (const url of soundUrls) {
          audioBuffer = await this.loadSound(url);
          if (audioBuffer) break; // 成功したらループを抜ける
        }
      } else {
        // 通常の効果音
        audioBuffer = await this.loadSound(soundUrl);
      }
      
      // オーディオバッファが取得できない場合はデフォルトのものを試す
      if (!audioBuffer) {
        console.log(`${effectType}の代替効果音を使用します`);
        audioBuffer = await this.loadSound(DEFAULT_SOUND_THEME.effects[effectType]);
      }
      
      // それでも取得できない場合は何もしない
      if (!audioBuffer) {
        console.warn(`効果音 ${effectType} を再生できません`);
        return;
      }
      
      const context = this.initAudioContext();
      
      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);
      source.start(0);
    } catch (error) {
      console.error('効果音の再生に失敗:', effectType, error);
      // エラーを無視して処理を続行（サウンドがなくてもゲームは続行可能）
    }
  }
  
  // 効果音の有効/無効を切り替え
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  // 特定の効果音を設定
  public setSoundEffect(effectType: keyof SoundEffect, soundPath: string): void {
    // 固定サウンドは変更できない
    if (['win', 'draw', 'reset'].includes(effectType)) {
      return;
    }
    
    const newEffects = {
      ...this.currentTheme.effects,
      [effectType]: soundPath
    };
    
    this.saveCustomSoundSettings(newEffects);
  }
  
  // AudioContextを再開（ユーザージェスチャーの後に呼び出す必要がある）
  public resumeAudioContext(): void {
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  }
}

// シングルトンインスタンス
const soundPlayer = typeof window !== 'undefined' ? new SoundPlayer() : null;

// サウンド再生ユーティリティ関数
export const playSound = async (effectType: keyof SoundEffect): Promise<void> => {
  if (soundPlayer) {
    await soundPlayer.play(effectType);
  }
};

// サウンド設定ユーティリティ関数
export const setSoundEnabled = (enabled: boolean): void => {
  if (soundPlayer) {
    soundPlayer.setEnabled(enabled);
  }
};

// 個別の効果音を設定するユーティリティ関数
export const setSoundEffect = (effectType: keyof SoundEffect, soundPath: string): void => {
  if (soundPlayer) {
    soundPlayer.setSoundEffect(effectType, soundPath);
  }
};

export const resumeAudioContext = (): void => {
  if (soundPlayer) {
    soundPlayer.resumeAudioContext();
  }
}; 