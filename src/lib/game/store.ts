import { create } from 'zustand';
import { 
  GameState, 
  GameSettings, 
  Move, 
  PlayerType, 
  Rotation,
  GameMode,
  AIDifficulty,
  BlockPosition,
  RotationDirection
} from '@/types';
import { 
  initializeBoard, 
  placeDisc, 
  rotateBlock, 
  checkWinner,
  getRandomRotation,
  getBlockIndexFromPosition
} from './core';
import { getAIMove } from '@/lib/ai';
import { playSound } from '@/lib/audio';

// ゲームの初期設定
const DEFAULT_SETTINGS: GameSettings = {
  gameMode: 'pvp',
  aiDifficulty: 'medium',
  soundEnabled: true
};

// ゲームの初期状態
const initialGameState: GameState = {
  board: initializeBoard(),
  currentPlayer: 'black',
  winner: null,
  blockRotations: {
    0: 0,
    1: 0,
    2: 0,
    3: 0
  },
  maxRotations: Infinity, // 無限に回転可能に変更
  lastMove: null,
  lastRotation: null,
  isGameOver: false,
  isProcessingMove: false, // 移動処理中かどうかのフラグ
  settings: DEFAULT_SETTINGS
};

// ゲームストアの型
interface GameStore extends GameState {
  // ゲームの設定を更新
  updateSettings: (settings: Partial<GameSettings>) => void;
  
  // 駒を配置
  placeDisc: (move: Move) => void;
  
  // 手番をスキップ（回転のみを行う場合）
  skipTurn: () => void;
  
  // ゲームをリセット
  resetGame: () => void;
  
  // AIの手番を実行
  playAITurn: () => void;
}

// マス目が全て埋まっているかチェックする関数
const isBoardFull = (board: (PlayerType | null)[][]) => {
  // 一番上の行で空きマスがあるかチェック
  return !board[0].some(cell => cell === null);
};

// ブロックが全て埋まっているかチェックする関数
const isBlockFull = (board: (PlayerType | null)[][], blockIndex: BlockPosition): boolean => {
  const { startRow, startCol } = (() => {
    switch (blockIndex) {
      case 0: return { startRow: 0, startCol: 0 };
      case 1: return { startRow: 0, startCol: 2 };
      case 2: return { startRow: 2, startCol: 0 };
      case 3: return { startRow: 2, startCol: 2 };
    }
  })();
  
  // 2x2ブロック内のすべてのセルが埋まっているかチェック
  for (let row = startRow; row < startRow + 2; row++) {
    for (let col = startCol; col < startCol + 2; col++) {
      if (board[row][col] === null) {
        return false; // 空のセルがあればブロックは埋まっていない
      }
    }
  }
  
  return true; // すべてのセルが埋まっている
};

// ゲーム状態チェックとプレイヤー切り替え共通関数
const checkGameStateAndSwitchPlayer = (
  get: () => GameState,
  set: (
    partial: GameState | Partial<GameState> | ((state: GameState) => GameState | Partial<GameState>),
  ) => void
) => {
  const currentState = get();
  const winner = checkWinner(currentState.board);
  
  if (winner) {
    // サウンド再生
    if (currentState.settings.soundEnabled) {
      playSound(winner === 'draw' ? 'draw' : 'win');
    }
    
    // 勝者を設定
    set({ winner, isGameOver: true });
    return true; // ゲーム終了
  }
  
  // 引き分けをチェック
  if (isBoardFull(currentState.board)) {
    if (currentState.settings.soundEnabled) {
      playSound('draw');
    }
    
    set({ isGameOver: true, winner: null });
    return true; // ゲーム終了（引き分け）
  }
  
  // 次のプレイヤーに交代
  const nextPlayer = currentState.currentPlayer === 'black' ? 'white' : 'black';
  set({ currentPlayer: nextPlayer });
  
  // PvEモードで、次がAIの手番の場合
  if (currentState.settings.gameMode === 'pve' && nextPlayer === 'white') {
    setTimeout(() => {
      const gameStore = get() as GameStore;
      gameStore.playAITurn();
    }, 500); // 少し遅延させてAIの動きを見せる
  }
  
  return false; // ゲーム継続
};

// ゲームストアの作成
export const useGameStore = create<GameStore>((set, get) => ({
  ...initialGameState,
  
  // ゲームの設定を更新
  updateSettings: (newSettings) => {
    const currentState = get();
    const currentGameMode = currentState.settings.gameMode;
    
    // 設定を更新
    set((state) => ({
      settings: {
        ...state.settings,
        ...newSettings
      }
    }));
    
    // ゲームモードが変更された場合、ゲームをリセット
    // PvPからPvEまたはPvEからPvPに変更された場合
    if ((currentGameMode === 'pvp' && newSettings.gameMode === 'pve') ||
        (currentGameMode === 'pve' && newSettings.gameMode === 'pvp')) {
      // リセット処理を遅延実行（設定変更が先に適用されるようにするため）
      setTimeout(() => {
        get().resetGame();
      }, 10);
    }
  },
  
  // 駒を配置
  placeDisc: (move) => {
    const state = get();
    
    // ゲームが終了している場合または処理中の場合は何もしない
    if (state.isGameOver || state.isProcessingMove) return;
    
    // 新しいボード状態を取得
    const newBoard = placeDisc(state.board, move, state.currentPlayer);
    
    // 無効な手の場合（同じボードが返ってきた場合）は何もしない
    if (newBoard === state.board) return;
    
    // 処理開始のフラグを立てる
    set({ isProcessingMove: true });
    
    // サウンド再生
    if (state.settings.soundEnabled) {
      playSound('placement');
    }
    
    // 状態を更新
    set((state) => ({
      board: newBoard,
      lastMove: { ...move, player: state.currentPlayer },
    }));
    
    // 駒を置いた後の処理（自動回転）
    setTimeout(() => {
      const currentState = get();
      
      // 駒を置いた位置からブロックインデックスを特定
      const blockIndex = getBlockIndexFromPosition(move.row, move.col);
      
      // サウンド再生
      if (currentState.settings.soundEnabled) {
        playSound('rotation');
      }
      
      // 状態を更新（時計回りに回転）
      set((state) => ({
        board: rotateBlock(state.board, blockIndex, 'clockwise'),
        blockRotations: {
          ...state.blockRotations,
          [blockIndex]: state.blockRotations[blockIndex] + 1
        },
        lastRotation: {
          blockIndex,
          direction: 'clockwise'
        }
      }));
      
      // 勝敗の確認と次のプレイヤー交代の処理は回転後に行う
      const updatedState = get();
      const winner = checkWinner(updatedState.board);
      
      if (winner) {
        // サウンド再生
        if (updatedState.settings.soundEnabled) {
          playSound(winner === 'draw' ? 'draw' : 'win');
        }
        
        // 勝者を設定
        set({ winner, isGameOver: true, isProcessingMove: false });
        return;
      }
      
      // 次のプレイヤーに交代し、処理完了フラグを下げる
      const nextPlayer = updatedState.currentPlayer === 'black' ? 'white' : 'black';
      set({ currentPlayer: nextPlayer, isProcessingMove: false });
      
      // PvEモードで、次がAIの手番の場合
      if (updatedState.settings.gameMode === 'pve' && nextPlayer === 'white') {
        setTimeout(() => {
          get().playAITurn();
        }, 500); // 少し遅延させてAIの動きを見せる
      }
    }, 1500); // 駒配置アニメーション（1000ms）+ 余裕（500ms）
  },
  
  // 手番をスキップ（回転のみを行う場合に使用）
  skipTurn: () => {
    const state = get();
    
    // 処理中または終了している場合は何もしない
    if (state.isProcessingMove || state.isGameOver) return;
    
    // 処理開始のフラグを立てる
    set({ isProcessingMove: true });
    
    const nextPlayer = state.currentPlayer === 'black' ? 'white' : 'black';
    set({ currentPlayer: nextPlayer, isProcessingMove: false });
    
    // PvEモードで、次がAIの手番の場合
    if (state.settings.gameMode === 'pve' && nextPlayer === 'white') {
      setTimeout(() => {
        get().playAITurn();
      }, 500);
    }
  },
  
  // ゲームをリセット
  resetGame: () => {
    // サウンド再生
    if (get().settings.soundEnabled) {
      playSound('reset');
    }
    
    // 設定以外の状態をリセット
    const currentSettings = get().settings;
    set({
      ...initialGameState,
      settings: currentSettings
    });
  },
  
  // AIの手番を実行
  playAITurn: () => {
    const state = get();
    
    // ゲームが終了している場合または処理中の場合は何もしない
    if (state.isGameOver || state.isProcessingMove) return;
    
    // PvEモードでない、またはAIの手番でない場合は何もしない
    if (state.settings.gameMode !== 'pve' || state.currentPlayer !== 'white') return;
    
    // 処理開始のフラグを立てる
    set({ isProcessingMove: true });
    
    // 最強モード用にゲーム状態を共有（window経由）
    if (typeof window !== 'undefined') {
      window.__GAME_STATE__ = {
        board: state.board,
        blockRotations: state.blockRotations,
        maxRotations: state.maxRotations,
        currentPlayer: state.currentPlayer
      };
    }
    
    // AIの手を取得
    const aiMove = getAIMove(state.board, state.settings.aiDifficulty, 'white');
    
    // 有効な手がない場合は処理を終了
    if (!aiMove) {
      set({ isProcessingMove: false });
      return;
    }
    
    // AIが駒を配置
    const newBoard = placeDisc(state.board, aiMove, 'white');
    
    // サウンド再生
    if (state.settings.soundEnabled) {
      playSound('placement');
    }
    
    // 状態を更新
    set((state) => ({
      board: newBoard,
      lastMove: { ...aiMove, player: 'white' },
    }));
    
    // 駒を置いた後の処理（自動回転）
    setTimeout(() => {
      const currentState = get();
      
      // 駒を置いた位置からブロックインデックスを特定
      const blockIndex = getBlockIndexFromPosition(aiMove.row, aiMove.col);
      
      // サウンド再生
      if (currentState.settings.soundEnabled) {
        playSound('rotation');
      }
      
      // 状態を更新（時計回りに回転）
      set((state) => ({
        board: rotateBlock(state.board, blockIndex, 'clockwise'),
        blockRotations: {
          ...state.blockRotations,
          [blockIndex]: state.blockRotations[blockIndex] + 1
        },
        lastRotation: {
          blockIndex,
          direction: 'clockwise'
        }
      }));
      
      // 勝敗の確認と次のプレイヤー交代の処理は回転後に行う
      const updatedState = get();
      const winner = checkWinner(updatedState.board);
      
      if (winner) {
        // サウンド再生
        if (updatedState.settings.soundEnabled) {
          playSound(winner === 'draw' ? 'draw' : 'win');
        }
        
        // 勝者を設定
        set({ winner, isGameOver: true, isProcessingMove: false });
        return;
      }
      
      // 次のプレイヤーに交代し、処理完了フラグを下げる
      const nextPlayer = updatedState.currentPlayer === 'black' ? 'white' : 'black';
      set({ currentPlayer: nextPlayer, isProcessingMove: false });
      
      // PvEモードで、次がAIの手番の場合
      if (updatedState.settings.gameMode === 'pve' && nextPlayer === 'white') {
        setTimeout(() => {
          get().playAITurn();
        }, 500); // 少し遅延させてAIの動きを見せる
      }
    }, 1500); // 駒配置アニメーション（1000ms）+ 余裕（500ms）
  }
})); 