'use client';

import { useState, useEffect } from 'react';
import { SoundEffect } from '@/types';
import { playSound, setSoundEffect } from '@/lib/audio';

// 変更可能な効果音のタイプ
const EDITABLE_SOUND_EFFECTS: (keyof SoundEffect)[] = [
  'placement',
  'rotation'
];

// 固定の効果音タイプ
const FIXED_SOUND_EFFECTS: (keyof SoundEffect)[] = [
  'win',
  'draw',
  'reset'
];

// 効果音の日本語名
const SOUND_EFFECT_NAMES: Record<keyof SoundEffect, string> = {
  placement: '駒を置く',
  rotation: '回転',
  win: '勝利',
  draw: '引き分け',
  reset: 'リセット'
};

interface SoundFile {
  name: string;
  path: string;
}

interface CustomSoundSelectorProps {
  onClose: () => void;
}

export function CustomSoundSelector({ onClose }: CustomSoundSelectorProps) {
  // 現在選択中の効果音タイプ
  const [selectedEffectType, setSelectedEffectType] = useState<keyof SoundEffect>('placement');
  
  // 利用可能なサウンドファイルリスト
  const [availableSounds, setAvailableSounds] = useState<SoundFile[]>([]);
  
  // 現在の効果音設定
  const [currentSettings, setCurrentSettings] = useState<Record<keyof SoundEffect, string>>({
    placement: '/sounds/default/placement.mp3',
    rotation: '/sounds/default/rotation.mp3',
    win: '/sounds/default/placement.mp3',
    draw: '/sounds/default/draw.mp3',
    reset: '/sounds/default/reset.mp3'
  });
  
  // サウンドの読み込み中フラグ
  const [isLoading, setIsLoading] = useState(true);

  // 利用可能なサウンドファイルを取得
  useEffect(() => {
    async function fetchAvailableSounds() {
      setIsLoading(true);
      try {
        // APIエンドポイントからサウンドファイルリストを取得
        const response = await fetch('/api/sounds');
        
        if (response.ok) {
          const soundFiles = await response.json();
          // サウンドファイルを整形
          const formattedSounds = soundFiles.map((file: string) => ({
            name: getFileDisplayName(file),
            path: `/sounds/${file}`
          }));
          
          setAvailableSounds(formattedSounds);
        } else {
          console.error('サウンドファイルの取得に失敗しました。APIレスポンスエラー:', response.status);
          setAvailableSounds([]);
        }
      } catch (error) {
        console.error('サウンドファイルの取得に失敗しました:', error);
        setAvailableSounds([]);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchAvailableSounds();
  }, []);
  
  // 設定を読み込み
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('customSoundSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        if (parsedSettings.effects) {
          setCurrentSettings(prev => ({
            ...prev,
            ...parsedSettings.effects
          }));
        }
      }
    } catch (error) {
      console.error('設定の読み込みに失敗:', error);
    }
  }, []);
  
  // ファイル名から表示名を生成
  const getFileDisplayName = (filename: string): string => {
    // 拡張子を除去
    const nameWithoutExt = filename.replace(/\.(mp3|wav|ogg)$/, '');
    return nameWithoutExt;
  };

  // 効果音を変更
  const handleSoundChange = (effectType: keyof SoundEffect, soundPath: string) => {
    // 固定の効果音タイプは変更しない
    if (FIXED_SOUND_EFFECTS.includes(effectType)) return;
    
    // 設定を更新
    setCurrentSettings(prev => ({
      ...prev,
      [effectType]: soundPath
    }));
    
    // 実際に効果音を設定
    setSoundEffect(effectType, soundPath);
  };

  // 効果音のプレビュー
  const handlePreviewSound = (soundPath: string) => {
    // AudioContextを作成
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      fetch(soundPath)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.arrayBuffer();
        })
        .then(arrayBuffer => {
          return new Promise<AudioBuffer>((resolve, reject) => {
            audioContext.decodeAudioData(
              arrayBuffer,
              (decodedData) => resolve(decodedData),
              (error) => reject(error)
            );
          });
        })
        .then(audioBuffer => {
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);
          source.start(0);
        })
        .catch(error => {
          console.error('音声の再生に失敗しました:', error);
          // 特定のエラーに基づいて、よりわかりやすいメッセージを表示
          if (error.name === 'EncodingError' || error.message?.includes('decode')) {
            alert('このファイル形式はサポートされていないか、ファイルが壊れています。別の音声ファイルを選択してください。');
          } else if (error.message?.includes('HTTP')) {
            alert('ファイルが見つかりません。他の音声ファイルを選択してください。');
          } else {
            alert('音声の再生中にエラーが発生しました。別の音声ファイルを試してください。');
          }
        });
    } catch (error) {
      console.error('AudioContext の作成に失敗:', error);
      alert('お使いのブラウザは音声の再生をサポートしていません。');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">効果音設定</h2>
        
        {/* 説明テキスト */}
        <p className="text-sm text-gray-600 mb-4">
          「駒を置く」と「回転」の効果音をカスタマイズできます。「勝利」「引き分け」「リセット」の効果音は変更できません。
        </p>
        
        {/* 効果音タイプの選択 */}
        <div className="mb-4">
          <h3 className="font-semibold mb-2">効果音の種類を選択</h3>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {/* 変更可能な効果音 */}
            {EDITABLE_SOUND_EFFECTS.map(effectType => (
              <button
                key={effectType}
                className={`p-2 rounded-md ${
                  selectedEffectType === effectType 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
                onClick={() => setSelectedEffectType(effectType)}
              >
                {SOUND_EFFECT_NAMES[effectType]}
              </button>
            ))}
            
            {/* 固定の効果音（無効） */}
            {FIXED_SOUND_EFFECTS.map(effectType => (
              <button
                key={effectType}
                className="p-2 rounded-md bg-gray-100 text-gray-400 cursor-not-allowed"
                disabled
              >
                {SOUND_EFFECT_NAMES[effectType]}
              </button>
            ))}
          </div>
          
          <div className="mb-2">
            <span className="font-medium">現在選択中: </span>
            <span>{SOUND_EFFECT_NAMES[selectedEffectType]}</span>
          </div>
          
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm">
              現在の設定: {currentSettings[selectedEffectType]?.split('/').pop() || '未設定'}
            </span>
            <button
              className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600"
              onClick={() => playSound(selectedEffectType)}
            >
              現在の設定をプレビュー
            </button>
          </div>
        </div>
        
        {/* 利用可能な効果音の一覧 */}
        <div className="mb-4">
          <h3 className="font-semibold mb-2">利用可能な効果音</h3>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-20">
              <p>読み込み中...</p>
            </div>
          ) : availableSounds.length === 0 ? (
            <div className="flex justify-center items-center h-20 text-gray-500">
              <p>利用可能な効果音はありません</p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md p-2">
              {availableSounds.map((sound, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                  <div>
                    <span className="text-sm">{sound.name}</span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded-md text-xs"
                      onClick={() => handlePreviewSound(sound.path)}
                    >
                      試聴
                    </button>
                    <button
                      className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-md text-xs"
                      onClick={() => handleSoundChange(selectedEffectType, sound.path)}
                      disabled={FIXED_SOUND_EFFECTS.includes(selectedEffectType)}
                    >
                      選択
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* アクションボタン */}
        <div className="flex justify-end space-x-3 mt-4">
          <button
            className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-md"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
} 