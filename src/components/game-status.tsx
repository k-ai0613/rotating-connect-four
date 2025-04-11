'use client';

import { PlayerType, GameMode } from '@/types';
import { cn } from '@/lib/utils';

export interface GameStatusProps {
  currentPlayer: PlayerType;
  winner: PlayerType | 'draw' | null;
  isGameOver?: boolean;
  gameMode?: GameMode;
  isWaiting?: boolean;
  onReset?: () => void;
}

export function GameStatus({ 
  currentPlayer, 
  winner, 
  isGameOver = false,
  gameMode = 'pvp',
  isWaiting = false,
  onReset
}: GameStatusProps) {
  // 勝者のテキストを取得
  const getWinnerText = () => {
    if (winner === 'black') {
      return '黒の勝利！';
    } else if (winner === 'white') {
      return '白の勝利！';
    } else if (winner === 'draw') {
      return '引き分け！';
    }
    return '';
  };

  // 現在のプレイヤーのテキストを取得
  const getCurrentPlayerText = () => {
    if (isWaiting) {
      return '対戦相手を待っています...';
    }
    
    if (gameMode === 'pve' && currentPlayer === 'white') {
      return 'AIの番です';
    }
    
    return `${currentPlayer === 'black' ? '黒' : '白'}の番です`;
  };

  // 駒の色に応じたテキストの色クラスを取得
  const getPlayerColor = (player: PlayerType | 'draw' | null) => {
    if (player === 'black') {
      return 'from-gray-800 to-black';
    } else if (player === 'white') {
      return 'from-gray-100 to-white';
    } else if (player === 'draw') {
      return 'from-blue-500 to-purple-500';
    }
    return '';
  };

  const getPlayerTextColor = (player: PlayerType | 'draw' | null) => {
    if (player === 'black') {
      return 'text-gray-900';
    } else if (player === 'white') {
      return 'text-gray-100';
    } else if (player === 'draw') {
      return 'text-blue-300';
    }
    return '';
  };

  return (
    <div className="w-full max-w-md mx-auto text-center py-4">
      {isGameOver ? (
        <div className="mb-6">
          <div className={cn(
            "inline-block px-6 py-3 rounded-full bg-gradient-to-r shadow-lg",
            getPlayerColor(winner)
          )}>
            <h2 className={cn(
              "text-2xl font-extrabold",
              winner === 'white' ? 'text-gray-900' : 'text-white'
            )}>
              {getWinnerText()}
            </h2>
          </div>
          <p className="text-gray-400 mt-4 bg-gray-800/50 p-3 rounded-lg">
            ゲームが終了しました。リセットするには設定から「ゲームをリセット」を押してください。
          </p>
        </div>
      ) : (
        <div className="mb-6">
          <div className="relative">
            <div className={cn(
              "px-6 py-3 rounded-full bg-gradient-to-r shadow-lg inline-block",
              getPlayerColor(currentPlayer)
            )}>
              <h2 className={cn(
                "text-xl font-bold",
                currentPlayer === 'white' ? 'text-gray-900' : 'text-white'
              )}>
                {getCurrentPlayerText()}
              </h2>
            </div>
            {isWaiting && (
              <div className="absolute -right-2 -top-2">
                <div className="animate-ping w-3 h-3 bg-yellow-400 rounded-full"></div>
              </div>
            )}
          </div>
          
          {gameMode === 'pvp' && (
            <p className="text-gray-400 mt-3 bg-gray-800/50 p-2 rounded-lg text-sm">
              交互に駒を配置し、4つ並べると勝利です
            </p>
          )}
          {gameMode === 'pve' && currentPlayer === 'black' && (
            <p className="text-gray-400 mt-3 bg-gray-800/50 p-2 rounded-lg text-sm">
              あなたの番です。駒を配置してください
            </p>
          )}
        </div>
      )}

      <div className="flex justify-center items-center gap-4 bg-gray-800/50 py-3 px-6 rounded-full shadow-inner">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          currentPlayer === 'black' && !isGameOver 
            ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-gray-800" 
            : "",
          "bg-gradient-to-b from-gray-800 to-black shadow-lg"
        )}>
          <span className="text-white text-xs">●</span>
        </div>
        <div className="text-gray-400 font-bold">VS</div>
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          currentPlayer === 'white' && !isGameOver 
            ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-gray-800" 
            : "",
          "bg-gradient-to-b from-gray-100 to-white shadow-lg"
        )}>
          <span className="text-black text-xs">○</span>
        </div>
      </div>
    </div>
  );
} 