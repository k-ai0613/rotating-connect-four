'use client';

import { useState } from 'react';
import type { GameSettings } from '@/types';
import { GameMode, AIDifficulty } from '@/types';
import { CustomSoundSelector } from './custom-sound-selector';

interface GameSettingsProps {
  settings: GameSettings;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
  onReset: () => void;
  disabled?: boolean;
}

export function GameSettings({ 
  settings, 
  onUpdateSettings, 
  onReset,
  disabled = false 
}: GameSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomSoundSelector, setShowCustomSoundSelector] = useState(false);

  const handleGameModeChange = (gameMode: GameMode) => {
    onUpdateSettings({ gameMode });
  };

  const handleAIDifficultyChange = (aiDifficulty: AIDifficulty) => {
    onUpdateSettings({ aiDifficulty });
  };

  const handleSoundEnabledChange = (soundEnabled: boolean) => {
    onUpdateSettings({ soundEnabled });
  };
  
  const handleCustomSoundSelectorOpen = () => {
    setShowCustomSoundSelector(true);
  };
  
  const handleCustomSoundSelectorClose = () => {
    setShowCustomSoundSelector(false);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white py-2 px-4 rounded-lg flex items-center gap-2 shadow-lg transition-all duration-200 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          disabled={disabled}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
            <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
            <path d="M12 2v2" />
            <path d="M12 22v-2" />
            <path d="m17 20.66-1-1.73" />
            <path d="M11 10.27 7 3.34" />
            <path d="m20.66 17-1.73-1" />
            <path d="m3.34 7 1.73 1" />
            <path d="M22 12h-2" />
            <path d="M2 12h2" />
            <path d="m20.66 7-1.73 1" />
            <path d="m3.34 17 1.73-1" />
            <path d="m17 3.34-1 1.73" />
            <path d="m7 20.66 1-1.73" />
          </svg>
          設定
        </button>

        {isOpen && (
          <div className="absolute top-full right-0 mt-2 w-72 bg-gray-800 backdrop-blur-md bg-opacity-95 rounded-xl shadow-2xl p-6 z-20 border border-gray-700 text-white">
            <h3 className="text-xl font-bold mb-6 text-blue-300 border-b border-gray-700 pb-2">ゲーム設定</h3>
            
            <div className="mb-6">
              <h4 className="font-bold mb-3 text-blue-200">ゲームモード</h4>
              <div className="grid grid-cols-3 gap-2">
                <button
                  className={`py-2 px-3 rounded-lg transition-all duration-200 ${
                    settings.gameMode === 'pvp'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={() => handleGameModeChange('pvp')}
                  disabled={disabled}
                >
                  対人戦
                </button>
                <button
                  className={`py-2 px-3 rounded-lg transition-all duration-200 ${
                    settings.gameMode === 'pve'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={() => handleGameModeChange('pve')}
                  disabled={disabled}
                >
                  AI対戦
                </button>
                <button
                  className={`py-2 px-3 rounded-lg transition-all duration-200 ${
                    settings.gameMode === 'online'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={() => handleGameModeChange('online')}
                  disabled={disabled}
                >
                  オンライン
                </button>
              </div>
            </div>
          
            {settings.gameMode === 'pve' && (
              <div className="mb-6">
                <h4 className="font-bold mb-3 text-blue-200">AI難易度</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`py-2 px-3 rounded-lg transition-all duration-200 ${
                      settings.aiDifficulty === 'easy'
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                    onClick={() => handleAIDifficultyChange('easy')}
                    disabled={disabled}
                  >
                    かんたん
                  </button>
                  <button
                    className={`py-2 px-3 rounded-lg transition-all duration-200 ${
                      settings.aiDifficulty === 'medium'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                    onClick={() => handleAIDifficultyChange('medium')}
                    disabled={disabled}
                  >
                    ふつう
                  </button>
                  <button
                    className={`py-2 px-3 rounded-lg transition-all duration-200 ${
                      settings.aiDifficulty === 'hard'
                        ? 'bg-yellow-600 text-white shadow-md'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                    onClick={() => handleAIDifficultyChange('hard')}
                    disabled={disabled}
                  >
                    むずかしい
                  </button>
                  <button
                    className={`py-2 px-3 rounded-lg transition-all duration-200 ${
                      settings.aiDifficulty === 'expert'
                        ? 'bg-orange-600 text-white shadow-md'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                    onClick={() => handleAIDifficultyChange('expert')}
                    disabled={disabled}
                  >
                    じょうきゅう
                  </button>
                  <button
                    className={`py-2 px-3 col-span-2 rounded-lg transition-all duration-200 ${
                      settings.aiDifficulty === 'master'
                        ? 'bg-red-600 text-white shadow-md'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                    onClick={() => handleAIDifficultyChange('master')}
                    disabled={disabled}
                  >
                    さいきょう
                  </button>
                </div>
              </div>
            )}

            <div className="mb-6">
              <h4 className="font-bold mb-3 text-blue-200">効果音</h4>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                  <label htmlFor="sound-toggle" className="text-gray-300">効果音を有効にする</label>
                  <button
                    className={`w-12 h-6 rounded-full relative ${
                      settings.soundEnabled ? 'bg-green-500' : 'bg-gray-600'
                    } transition-colors duration-300 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                    onClick={() => handleSoundEnabledChange(!settings.soundEnabled)}
                    disabled={disabled}
                    data-pressed={settings.soundEnabled.toString()}
                    aria-label={`効果音を${settings.soundEnabled ? '無効' : '有効'}にする`}
                    id="sound-toggle"
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform duration-300 ${
                        settings.soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
                
                {settings.soundEnabled && (
                  <button
                    className={`w-full py-2 px-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:brightness-110 transition-all duration-300 shadow-md ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                    onClick={handleCustomSoundSelectorOpen}
                    disabled={disabled}
                  >
                    効果音をカスタマイズ
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex justify-between gap-2">
              <button
                className={`py-2 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:brightness-110 text-white rounded-lg shadow-md transition-all duration-200 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={onReset}
                disabled={disabled}
              >
                リセット
              </button>
              <button
                className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg shadow-md transition-all duration-200"
                onClick={() => setIsOpen(false)}
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
      
      {showCustomSoundSelector && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50">
          <div className="bg-gray-800 bg-opacity-95 p-6 rounded-xl border border-gray-700 shadow-2xl max-w-md w-full max-h-[90vh] overflow-auto">
            <CustomSoundSelector onClose={handleCustomSoundSelectorClose} />
          </div>
        </div>
      )}
    </>
  );
} 