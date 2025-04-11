'use client';

import { useState, useEffect, useRef } from 'react';
import { BoardState, PlayerType, BlockPosition, RotationDirection, Move, Rotation } from '@/types';
import { cn } from '@/lib/utils';

// ブロックの配色を定義
const BLOCK_COLORS = {
  0: 'from-blue-800 to-blue-600',
  1: 'from-purple-800 to-purple-600',
  2: 'from-green-800 to-green-600',
  3: 'from-red-800 to-red-600',
};

// ブロックの境界を強調するCSS
const BLOCK_BORDERS = {
  0: 'border-t-2 border-l-2 border-blue-300',
  1: 'border-t-2 border-r-2 border-purple-300',
  2: 'border-b-2 border-l-2 border-green-300',
  3: 'border-b-2 border-r-2 border-red-300',
};

interface GameBoardProps {
  board: BoardState;
  currentPlayer: PlayerType;
  isGameOver: boolean;
  blockRotations: Record<BlockPosition, number>;
  maxRotations: number;
  onPlaceDisc: (move: Move) => void;
  onRotateBlock?: (rotation: Rotation) => void;
  lastMove: { row: number; col: number; player: PlayerType } | null;
  lastRotation: { blockIndex: BlockPosition; direction: RotationDirection } | null;
  isSpectator?: boolean;
  isWrongTurn?: boolean;
}

// 回転をスキップするボタン（手動回転モード用）
interface SkipRotationButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

function SkipRotationButton({ onClick, disabled = false }: SkipRotationButtonProps) {
  return (
    <button
      className={`mt-2 py-2 px-4 rounded-md ${
        disabled
          ? 'bg-gray-400 cursor-not-allowed'
          : 'bg-yellow-600 hover:bg-yellow-500 text-white'
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      回転をスキップ
    </button>
  );
}

export function GameBoard({
  board,
  currentPlayer,
  isGameOver,
  blockRotations,
  maxRotations,
  onPlaceDisc,
  onRotateBlock,
  lastMove,
  lastRotation,
  isSpectator = false,
  isWrongTurn = false,
}: GameBoardProps) {
  // 選択中のブロックインデックス
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<BlockPosition | null>(null);
  
  // アニメーション用の状態
  const [rotatingCells, setRotatingCells] = useState<Array<{ row: number; col: number; delay: number }>>([]);
  const [rotatedCells, setRotatedCells] = useState<Array<{ row: number; col: number }>>([]);
  const [placedCells, setPlacedCells] = useState<Array<{ row: number; col: number }>>([]);
  const [animationKey, setAnimationKey] = useState(0);
  
  // 駒の配置と回転をトラッキング
  useEffect(() => {
    if (lastMove) {
      // 新しい駒が配置されたら、その位置をplacedCellsに追加
      setPlacedCells([{ row: lastMove.row, col: lastMove.col }]);
      
      // 1秒後にアニメーションをリセット
      const timeoutId = setTimeout(() => {
        setPlacedCells([]);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [lastMove]);
  
  // 回転のアニメーション
  useEffect(() => {
    if (lastRotation) {
      const { blockIndex, direction } = lastRotation;
      const { startRow, startCol } = getBlockCoordinates(blockIndex);
      
      // 回転するブロック内の4つのセルを計算し、アニメーション用の遅延を設定
      const cells = [
        { row: startRow, col: startCol, delay: 0 },
        { row: startRow, col: startCol + 1, delay: 1 },
        { row: startRow + 1, col: startCol + 1, delay: 2 },
        { row: startRow + 1, col: startCol, delay: 3 }
      ];
      
      if (direction === 'counter-clockwise') {
        // 反時計回りの場合は遅延の順序を逆にする
        cells[1].delay = 3;
        cells[2].delay = 2;
        cells[3].delay = 1;
      }
      
      // アニメーション状態を更新
      setRotatingCells(cells);
      setAnimationKey(prev => prev + 1);
      
      // アニメーション完了後に状態をリセット
      const timeoutId = setTimeout(() => {
        setRotatedCells(cells);
        setRotatingCells([]);
        
        // さらに少し遅延を入れてから、回転済みフラグもリセット
        setTimeout(() => {
          setRotatedCells([]);
        }, 500);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [lastRotation]);
  
  // ブロックの座標を取得
  const getBlockCoordinates = (blockIndex: BlockPosition): { startRow: number; startCol: number } => {
    switch (blockIndex) {
      case 0: return { startRow: 0, startCol: 0 };
      case 1: return { startRow: 0, startCol: 2 };
      case 2: return { startRow: 2, startCol: 0 };
      case 3: return { startRow: 2, startCol: 2 };
      default: return { startRow: 0, startCol: 0 };
    }
  };

  // 座標からブロックインデックスを取得する
  const getBlockIndexFromPosition = (row: number, col: number): BlockPosition => {
    if (row < 2) {
      return col < 2 ? 0 : 1;
    } else {
      return col < 2 ? 2 : 3;
    }
  };

  // セルのクリック
  const handleCellClick = (row: number, col: number) => {
    if (isGameOver || isSpectator || isWrongTurn) return;
    
    // すでにマスが埋まっている場合は何もしない
    if (board[row][col] !== null) return;
    
    onPlaceDisc({ row, col });
  };
  
  // ブロックの回転
  const handleBlockRotation = (blockIndex: BlockPosition, direction: RotationDirection) => {
    if (isGameOver || isSpectator || isWrongTurn || !onRotateBlock) return;
    
    // 回転回数が上限に達している場合は何もしない
    if (blockRotations[blockIndex] >= maxRotations) return;
    
    onRotateBlock({ blockIndex, direction });
  };

  // セルがハイライト表示されるかどうかを判定
  const isCellHighlighted = (row: number, col: number): boolean => {
    if (lastMove) {
      return row === lastMove.row && col === lastMove.col;
    }
    
    return false;
  };

  // セルが最後に回転されたブロックに含まれるかどうかを判定
  const isCellInLastRotatedBlock = (row: number, col: number): boolean => {
    if (!lastRotation) return false;
    
    const { startRow, startCol } = getBlockCoordinates(lastRotation.blockIndex);
    return row >= startRow && row < startRow + 2 && col >= startCol && col < startCol + 2;
  };

  // セルが現在回転アニメーション中かどうかを判定し、遅延を取得
  const getRotationAnimationDelay = (row: number, col: number): number | null => {
    const cell = rotatingCells.find(c => c.row === row && c.col === col);
    return cell ? cell.delay : null;
  };
  
  // セルが回転済みかどうかを判定
  const isCellRotated = (row: number, col: number): boolean => {
    return rotatedCells.some(cell => cell.row === row && cell.col === col);
  };

  // セルに駒が置かれたばかりかどうかを判定
  const isCellPlaced = (row: number, col: number): boolean => {
    return placedCells.some(cell => cell.row === row && cell.col === col);
  };

  // セルのブロックインデックスを取得
  const getBlockForCell = (row: number, col: number): BlockPosition => {
    return getBlockIndexFromPosition(row, col);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* ゲームボード */}
      <div className="grid grid-cols-4 gap-1 p-3 bg-gray-900 rounded-xl shadow-xl border border-gray-700" key={`board-${animationKey}`}>
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const rotationDelay = getRotationAnimationDelay(rowIndex, colIndex);
            const isRotating = rotationDelay !== null;
            const isRotated = isCellRotated(rowIndex, colIndex);
            const isPlaced = isCellPlaced(rowIndex, colIndex);
            const blockIndex = getBlockForCell(rowIndex, colIndex);
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={cn(
                  "w-16 h-16 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-300 relative",
                  `block-${blockIndex}`,
                  isCellHighlighted(rowIndex, colIndex) && "ring-2 ring-yellow-400",
                  isCellInLastRotatedBlock(rowIndex, colIndex) && !isRotating && "ring-2 ring-white/50 block-highlight",
                  isRotating && "rotate-animation ring-2 ring-white brightness-125",
                  isRotated && "rotated",
                  isRotating && rotationDelay === 0 && "rotate-delay-0",
                  isRotating && rotationDelay === 1 && "rotate-delay-1",
                  isRotating && rotationDelay === 2 && "rotate-delay-2",
                  isRotating && rotationDelay === 3 && "rotate-delay-3",
                  (isSpectator || isWrongTurn) && "cursor-not-allowed opacity-90"
                )}
                onClick={() => handleCellClick(rowIndex, colIndex)}
              >
                {/* 残りの回転回数を表示するバッジ */}
                {maxRotations !== Infinity && blockRotations && (
                  <div className="absolute top-0 right-0 text-xs bg-gray-800 text-white rounded-full w-5 h-5 flex items-center justify-center">
                    {Math.max(0, maxRotations - blockRotations[blockIndex])}
                  </div>
                )}
                
                {cell && (
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full transition-all flex items-center justify-center",
                      cell === 'black' ? "bg-gradient-to-br from-gray-900 to-black text-white shadow-lg" : "bg-gradient-to-br from-gray-50 to-white text-black shadow-lg",
                      isPlaced && "scale-in-center bounce-disc font-bold ring-4 ring-yellow-300"
                    )}
                  >
                    {/* 駒に小さなマークを付ける */}
                    <span className="text-xs">{cell === 'black' ? '●' : '○'}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* 回転コントロール - オンラインモードで自分の手番のみ表示 */}
      {onRotateBlock && !isGameOver && !isSpectator && !isWrongTurn && (
        <div className="grid grid-cols-2 gap-3 mt-2">
          {[0, 1, 2, 3].map((blockIndex) => (
            <div key={`block-control-${blockIndex}`} className="flex flex-col items-center bg-gray-800/50 p-3 rounded-lg border border-gray-700">
              <span className="text-sm text-gray-300 mb-1">ブロック{blockIndex + 1}</span>
              <div className="flex space-x-2">
                <button
                  className={`px-3 py-1 rounded ${
                    blockRotations[blockIndex as BlockPosition] >= maxRotations
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-500'
                  }`}
                  onClick={() => handleBlockRotation(blockIndex as BlockPosition, 'clockwise')}
                  disabled={blockRotations[blockIndex as BlockPosition] >= maxRotations}
                  title="時計回り"
                >
                  ↻
                </button>
                <button
                  className={`px-3 py-1 rounded ${
                    blockRotations[blockIndex as BlockPosition] >= maxRotations
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-500'
                  }`}
                  onClick={() => handleBlockRotation(blockIndex as BlockPosition, 'counter-clockwise')}
                  disabled={blockRotations[blockIndex as BlockPosition] >= maxRotations}
                  title="反時計回り"
                >
                  ↺
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* ブロック説明 */}
      <div className="grid grid-cols-2 gap-2 mt-4 bg-gray-800/70 p-4 rounded-lg border border-gray-700">
        <h3 className="col-span-2 text-center font-bold text-blue-300 mb-2">回転するブロック</h3>
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-sm block-0 block-highlight"></div>
          <span className="text-sm text-white">ブロック1</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-sm block-1 block-highlight"></div>
          <span className="text-sm text-white">ブロック2</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-sm block-2 block-highlight"></div>
          <span className="text-sm text-white">ブロック3</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-sm block-3 block-highlight"></div>
          <span className="text-sm text-white">ブロック4</span>
        </div>
      </div>
      
      {/* オンラインモードでスペクテーターや自分の手番でない場合のオーバーレイ */}
      {(isSpectator || isWrongTurn) && (
        <div className="mt-2 px-4 py-2 bg-blue-900/60 text-blue-100 rounded-lg border border-blue-800 text-center">
          {isSpectator ? (
            <p>観戦モード: ゲームをプレイすることはできません</p>
          ) : (
            <p>相手の手番です。お待ちください</p>
          )}
        </div>
      )}
    </div>
  );
} 