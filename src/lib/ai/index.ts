import { AIDifficulty, BoardState, Move, PlayerType, RotationDirection, BlockPosition } from '@/types';
import { isValidMove, checkWinner, getRandomRotation, rotateBlock, getBlockIndexFromPosition } from '@/lib/game/core';

// 内部状態接続用のグローバル変数（ゲーム状態へのアクセス用）
declare global {
  interface Window {
    __GAME_STATE__?: {
      board: BoardState;
      blockRotations: Record<BlockPosition, number>;
      maxRotations: number;
      currentPlayer: PlayerType;
    };
  }
}

// 可能な全ての手を取得
function getAllPossibleMoves(board: BoardState): Move[] {
  const moves: Move[] = [];
  
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (board[row][col] === null) {
        moves.push({ row, col });
      }
    }
  }
  
  return moves;
}

// 勝利可能な手を見つける
function findWinningMove(board: BoardState, player: PlayerType): Move | null {
  const possibleMoves = getAllPossibleMoves(board);
  
  // 各手を試して、勝利するかどうかをチェック
  for (const move of possibleMoves) {
    const newBoard = [...board.map(row => [...row])];
    newBoard[move.row][move.col] = player;
    
    if (checkWinner(newBoard) === player) {
      return move;
    }
  }
  
  return null;
}

// 相手の勝利を阻止する手を見つける
function findBlockingMove(board: BoardState, player: PlayerType): Move | null {
  const opponent: PlayerType = player === 'black' ? 'white' : 'black';
  
  // 相手の勝利を阻止する = 相手が勝利する手を見つけて自分が先に打つ
  return findWinningMove(board, opponent);
}

// 中央優先の手を返す (戦略的に中央は有利)
function getStrategicMove(board: BoardState): Move | null {
  // 中央の優先順位
  const priorityPositions: Move[] = [
    { row: 1, col: 1 }, { row: 1, col: 2 }, 
    { row: 2, col: 1 }, { row: 2, col: 2 },
    { row: 0, col: 0 }, { row: 0, col: 3 },
    { row: 3, col: 0 }, { row: 3, col: 3 },
    { row: 0, col: 1 }, { row: 0, col: 2 },
    { row: 1, col: 0 }, { row: 1, col: 3 },
    { row: 2, col: 0 }, { row: 2, col: 3 },
    { row: 3, col: 1 }, { row: 3, col: 2 }
  ];
  
  for (const position of priorityPositions) {
    if (isValidMove(board, position)) {
      return position;
    }
  }
  
  return null;
}

// ランダムな手を返す
function getRandomMove(board: BoardState): Move | null {
  const possibleMoves = getAllPossibleMoves(board);
  
  if (possibleMoves.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * possibleMoves.length);
  return possibleMoves[randomIndex];
}

// ボードを評価する関数（ミニマックス用）
function evaluateBoard(board: BoardState, player: PlayerType): number {
  const winner = checkWinner(board);
  
  if (winner === player) {
    return 100; // 勝利
  } else if (winner === (player === 'black' ? 'white' : 'black')) {
    return -100; // 敗北
  } else if (winner === 'draw') {
    return 0; // 引き分け
  }
  
  // 勝者がまだいない場合、より高度な評価を行う
  return evaluatePatterns(board, player);
}

// ミニマックスアルゴリズム
function minimax(
  board: BoardState,
  depth: number,
  isMaximizing: boolean,
  player: PlayerType,
  alpha: number = -Infinity,
  beta: number = Infinity
): number {
  const opponent: PlayerType = player === 'black' ? 'white' : 'black';
  const winner = checkWinner(board);
  
  // 終了条件
  if (winner === player) return 100 - depth;
  if (winner === opponent) return depth - 100;
  if (winner === 'draw' || depth === 0) return 0;
  
  const possibleMoves = getAllPossibleMoves(board);
  if (possibleMoves.length === 0) return 0;
  
  if (isMaximizing) {
    let maxEval = -Infinity;
    
    for (const move of possibleMoves) {
      const newBoard = [...board.map(row => [...row])];
      newBoard[move.row][move.col] = player;
      
      const evalScore = minimax(newBoard, depth - 1, false, player, alpha, beta);
      maxEval = Math.max(maxEval, evalScore);
      
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break; // Alpha-Beta剪定
    }
    
    return maxEval;
  } else {
    let minEval = Infinity;
    
    for (const move of possibleMoves) {
      const newBoard = [...board.map(row => [...row])];
      newBoard[move.row][move.col] = opponent;
      
      const evalScore = minimax(newBoard, depth - 1, true, player, alpha, beta);
      minEval = Math.min(minEval, evalScore);
      
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break; // Alpha-Beta剪定
    }
    
    return minEval;
  }
}

// 最適な手を見つける（ミニマックス使用）
function findBestMove(board: BoardState, player: PlayerType, maxDepth: number = 4): Move | null {
  const possibleMoves = getAllPossibleMoves(board);
  
  if (possibleMoves.length === 0) {
    return null;
  }
  
  let bestMove: Move | null = null;
  let bestValue = -Infinity;
  
  for (const move of possibleMoves) {
    const newBoard = [...board.map(row => [...row])];
    newBoard[move.row][move.col] = player;
    
    const moveValue = minimax(newBoard, maxDepth, false, player, -Infinity, Infinity);
    
    if (moveValue > bestValue) {
      bestValue = moveValue;
      bestMove = move;
    }
  }
  
  return bestMove;
}

// 難易度に応じたAIの手を決定
export function getAIMove(board: BoardState, difficulty: AIDifficulty, player: PlayerType = 'white'): Move | null {
  switch (difficulty) {
    case 'easy':
      // 簡単：ほぼランダムだが、たまに賢い手を選ぶ（20%の確率）
      if (Math.random() < 0.2) {
        const winningMove = findWinningMove(board, player);
        if (winningMove) return winningMove;
      }
      return getRandomMove(board);
      
    case 'medium':
      // 普通：勝利や阻止を優先し、40%の確率で戦略的な手を選択
      const mediumStrategicMove = 
        findWinningMove(board, player) ||
        findBlockingMove(board, player);
      
      if (mediumStrategicMove) return mediumStrategicMove;
      
      // 40%の確率で戦略的な手を選択、それ以外はランダム
      if (Math.random() < 0.4) {
        return getStrategicMove(board) || getRandomMove(board);
      }
      return getRandomMove(board);
      
    case 'hard':
      // 難しい：より高度な戦略的判断（強化版）と浅い探索の組み合わせ
      const hardMove = 
        findWinningMove(board, player) ||
        findBlockingMove(board, player) ||
        findTacticalMove(board, player);
      
      if (hardMove) return hardMove;
      
      // 60%の確率で戦略的な手、25%の確率で浅い探索を使用、それ以外はランダム
      const randomValue = Math.random();
      if (randomValue < 0.6) {
        return getStrategicMove(board) || getRandomMove(board);
      } else if (randomValue < 0.85) {
        // 浅い深さでミニマックスを使用
        return findBestMove(board, player, 3) || getRandomMove(board);
      }
      return getRandomMove(board);
      
    case 'expert':
      // 上級：強力なミニマックスと高度な評価関数で90%の強さ
      // 即座に勝てる手や相手の勝利阻止は常に実行
      const expertWinningMove = findWinningMove(board, player);
      if (expertWinningMove) return expertWinningMove;
      
      const expertBlockingMove = findBlockingMove(board, player);
      if (expertBlockingMove) return expertBlockingMove;
      
      // 90%の確率で深度6の探索、その他は戦術的な手を選択
      if (Math.random() < 0.9) {
        // より深い探索と高度な評価関数を使用
        const state = window.__GAME_STATE__;
        if (state && state.blockRotations) {
          // 回転も考慮した高度な評価を行う
          const expertSuperiorMove = findAdvancedMove(board, player, state.blockRotations, state.maxRotations);
          if (expertSuperiorMove) return expertSuperiorMove;
        }
        
        // 深度6の探索（最強に近い強さ）
        return findBestMove(board, player, 6) || findTacticalMove(board, player) || getStrategicMove(board) || getRandomMove(board);
      } 
      
      return findTacticalMove(board, player) || getStrategicMove(board) || getRandomMove(board);
      
    case 'master':
      // 最強：究極の評価関数と最深の探索で100%の強さ
      const state = window.__GAME_STATE__;
      if (state && state.blockRotations) {
        // 回転を考慮した最高峰AI
        const superiorMove = findUltimateBestMove(board, player, state.blockRotations, state.maxRotations);
        if (superiorMove) return superiorMove;
      }
      
      // 最深探索（バックアップとして）
      return findBestMove(board, player, 8);
      
    default:
      return getRandomMove(board);
  }
}

// 上級モード用の高度な手を見つける関数
function findAdvancedMove(
  board: BoardState,
  player: PlayerType,
  blockRotations: Record<BlockPosition, number>,
  maxRotations: number
): Move | null {
  // 即座に勝てる手は最優先
  const winningMove = findWinningMove(board, player);
  if (winningMove) return winningMove;
  
  // 相手の勝利を阻止する手も優先
  const blockingMove = findBlockingMove(board, player);
  if (blockingMove) return blockingMove;
  
  // 全ての可能な手を取得
  const possibleMoves = getAllPossibleMoves(board);
  if (possibleMoves.length === 0) return null;
  
  // 相手のプレイヤータイプ
  const opponent = player === 'black' ? 'white' : 'black';
  
  // 各手の評価を行う
  const evaluatedMoves = possibleMoves.map(move => {
    try {
      const newBoard = board.map(row => row ? [...row] : []);
      if (!newBoard[move.row] || newBoard[move.row][move.col] === undefined) {
        return { move, value: -Infinity };
      }
      
      newBoard[move.row][move.col] = player;
      
      // 戦術的価値を計算
      let tacticalValue = evaluateTacticalValue(newBoard, move, player) * 80;
      
      // 回転の可能性も考慮
      const blockIndex = getBlockIndexFromPosition(move.row, move.col) as BlockPosition;
      let rotationValue = 0;
      
      if (blockIndex !== null && blockRotations[blockIndex] < maxRotations) {
        // 両方向の回転を評価
        const clockwiseBoard = rotateBlock(newBoard, blockIndex, 'clockwise');
        const counterClockwiseBoard = rotateBlock(newBoard, blockIndex, 'counter-clockwise');
        
        // 回転で勝利できるかチェック
        if (checkWinner(clockwiseBoard) === player || checkWinner(counterClockwiseBoard) === player) {
          rotationValue += 1000; // 回転で勝利なら高評価
        }
        
        // 相手の勝利を防げる回転もチェック
        const opponentWinMove = findWinningMove(board, opponent);
        if (opponentWinMove) {
          if ((!isValidMove(clockwiseBoard, opponentWinMove) && checkWinner(clockwiseBoard) !== opponent) || 
              (!isValidMove(counterClockwiseBoard, opponentWinMove) && checkWinner(counterClockwiseBoard) !== opponent)) {
            rotationValue += 800;
          }
        }
        
        // 回転後の盤面評価
        const clockwiseValue = evaluateBoardAdvanced(clockwiseBoard, player);
        const counterClockwiseValue = evaluateBoardAdvanced(counterClockwiseBoard, player);
        
        // 最良の回転方向の価値を加算
        rotationValue += Math.max(clockwiseValue, counterClockwiseValue) * 0.8;
      }
      
      // 基本的な盤面評価
      const baseScore = evaluateBoardAdvanced(newBoard, player);
      
      // フォーク作成の可能性を評価
      const forkValue = evaluateForkPotential(newBoard, move, player) * 60;
      
      // 総合評価
      const totalScore = baseScore + tacticalValue + rotationValue + forkValue;
      
      return { move, value: totalScore };
    } catch (e) {
      console.error("Error evaluating advanced move:", e);
      return { move, value: -Infinity };
    }
  });
  
  // 評価値でソート
  evaluatedMoves.sort((a, b) => b.value - a.value);
  
  // 最良の手を選択
  if (evaluatedMoves.length > 0 && evaluatedMoves[0].value > -Infinity) {
    return evaluatedMoves[0].move;
  }
  
  // 万が一評価に失敗した場合のフォールバック
  return findTacticalMove(board, player) || getStrategicMove(board) || getRandomMove(board);
}

// 戦術的な手を見つける関数（より優れた中間手を選択）
function findTacticalMove(board: BoardState, player: PlayerType): Move | null {
  const possibleMoves = getAllPossibleMoves(board);
  const opponent = player === 'black' ? 'white' : 'black';
  
  if (possibleMoves.length === 0) return null;
  
  // 各手を評価して最良の手を選択
  let bestMove: Move | null = null;
  let bestScore = -Infinity;
  
  for (const move of possibleMoves) {
    const newBoard = board.map(row => row ? [...row] : []);
    if (!newBoard[move.row] || newBoard[move.row][move.col] === undefined) continue;
    
    newBoard[move.row][move.col] = player;
    
    // この手がどれだけ良いか評価
    let score = 0;
    
    // フォーク（複数の勝利ラインを作る）チェック
    score += evaluateForkPotential(newBoard, move, player) * 50;
    
    // 相手のフォークを防ぐ
    score += preventOpponentFork(board, move, player) * 40;
    
    // 中央の価値
    if ((move.row === 1 || move.row === 2) && (move.col === 1 || move.col === 2)) {
      score += 30;
    }
    
    // 対角線上の価値
    if ((move.row === move.col) || (move.row + move.col === 3)) {
      score += 15;
    }
    
    // ブロックを共有するラインの価値
    score += evaluateSharedLines(board, move, player) * 20;
    
    // 防御的価値（相手の有力な手を防ぐ）
    score += evaluateDefensiveValue(board, move, player) * 30;
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  
  return bestScore > 0 ? bestMove : null;
}

// フォークポテンシャルの評価（複数の勝利ラインを同時に狙う）
function evaluateForkPotential(board: BoardState, move: Move, player: PlayerType): number {
  // 潜在的な勝利ラインの数をカウント
  let potentialWinLines = 0;
  
  // 水平方向チェック
  if (board[move.row]) {
    const horizontalLine = board[move.row];
    const playerCount = horizontalLine.filter(cell => cell === player).length;
    const emptyCount = horizontalLine.filter(cell => cell === null).length;
    
    if (playerCount >= 2 && emptyCount >= 1) {
      potentialWinLines++;
    }
  }
  
  // 垂直方向チェック
  const verticalLine = [
    board[0]?.[move.col],
    board[1]?.[move.col],
    board[2]?.[move.col],
    board[3]?.[move.col]
  ];
  
  const verticalPlayerCount = verticalLine.filter(cell => cell === player).length;
  const verticalEmptyCount = verticalLine.filter(cell => cell === null).length;
  
  if (verticalPlayerCount >= 2 && verticalEmptyCount >= 1) {
    potentialWinLines++;
  }
  
  // 対角線チェック（該当する場合）
  if (move.row === move.col) { // 左上から右下
    const diagonal1 = [board[0]?.[0], board[1]?.[1], board[2]?.[2], board[3]?.[3]];
    const diag1PlayerCount = diagonal1.filter(cell => cell === player).length;
    const diag1EmptyCount = diagonal1.filter(cell => cell === null).length;
    
    if (diag1PlayerCount >= 2 && diag1EmptyCount >= 1) {
      potentialWinLines++;
    }
  }
  
  if (move.row + move.col === 3) { // 右上から左下
    const diagonal2 = [board[0]?.[3], board[1]?.[2], board[2]?.[1], board[3]?.[0]];
    const diag2PlayerCount = diagonal2.filter(cell => cell === player).length;
    const diag2EmptyCount = diagonal2.filter(cell => cell === null).length;
    
    if (diag2PlayerCount >= 2 && diag2EmptyCount >= 1) {
      potentialWinLines++;
    }
  }
  
  return potentialWinLines > 1 ? potentialWinLines : 0; // 2ライン以上あればフォーク
}

// 相手のフォークを防ぐ評価
function preventOpponentFork(board: BoardState, move: Move, player: PlayerType): number {
  const opponent = player === 'black' ? 'white' : 'black';
  const newBoard = board.map(row => row ? [...row] : []);
  if (!newBoard[move.row] || newBoard[move.row][move.col] === undefined) return 0;
  
  // 自分の手を置く
  newBoard[move.row][move.col] = player;
  
  // 相手の全ての可能な手について
  const opponentMoves = getAllPossibleMoves(newBoard);
  let maxForkPotential = 0;
  
  for (const opMove of opponentMoves) {
    const testBoard = newBoard.map(row => row ? [...row] : []);
    if (!testBoard[opMove.row] || testBoard[opMove.row][opMove.col] === undefined) continue;
    
    testBoard[opMove.row][opMove.col] = opponent;
    
    // この手で相手がフォークを作れるか
    const forkValue = evaluateForkPotential(testBoard, opMove, opponent);
    maxForkPotential = Math.max(maxForkPotential, forkValue);
  }
  
  // 相手のフォークを防げる度合いを返す
  return maxForkPotential === 0 ? 1 : 0; // フォークを防げれば1、そうでなければ0
}

// 共有ラインの評価（複数のラインに影響を与える手）
function evaluateSharedLines(board: BoardState, move: Move, player: PlayerType): number {
  try {
    const { row, col } = move;
    if (!board[row] || board[row][col] !== undefined) return 0;

    // マスの位置からブロックインデックスを取得
    const blockIndex = getBlockIndexFromPosition(row, col);
    
    // 同じ行、列、ブロック内のプレイヤーの石をカウント
    let count = 0;
    
    // 行を評価
    for (let c = 0; c < 4; c++) {
      if (board[row][c] === player) count++;
    }
    
    // 列を評価
    for (let r = 0; r < 4; r++) {
      if (board[r] && board[r][col] === player) count++;
    }
    
    // ブロック内を評価
    const blockCells = getBlockCells(blockIndex);
    for (const [r, c] of blockCells) {
      if (board[r] && board[r][c] === player) count++;
    }
    
    return count * 0.5; // 共有ラインの重要度を調整
  } catch (e) {
    console.error("Error in evaluateSharedLines:", e);
    return 0;
  }
}

// ブロックの全セルを取得する
function getBlockCells(blockIndex: BlockPosition | null): Array<[number, number]> {
  if (blockIndex === null) return [];

  switch (blockIndex) {
    case 0: // 左上ブロック
      return [[0, 0], [0, 1], [1, 0], [1, 1]];
    case 1: // 右上ブロック
      return [[0, 2], [0, 3], [1, 2], [1, 3]];
    case 2: // 左下ブロック
      return [[2, 0], [2, 1], [3, 0], [3, 1]];
    case 3: // 右下ブロック
      return [[2, 2], [2, 3], [3, 2], [3, 3]];
    default:
      return []; // 未知のブロックインデックスの場合は空配列を返す
  }
}

// 防御的価値の評価（相手の強い手を防ぐ）
function evaluateDefensiveValue(board: BoardState, move: Move, player: PlayerType): number {
  const opponent = player === 'black' ? 'white' : 'black';
  const newBoard = board.map(row => row ? [...row] : []);
  if (!newBoard[move.row] || newBoard[move.row][move.col] === undefined) return 0;
  
  // 相手がこの場所に置いた場合の価値
  newBoard[move.row][move.col] = opponent;
  
  // 相手のための評価
  let opponentValue = 0;
  
  // 相手が置いた場合に勝利ラインを作れるか
  const horizontalLine = newBoard[move.row];
  const opponentHorizontalCount = horizontalLine.filter(cell => cell === opponent).length;
  
  if (opponentHorizontalCount >= 3) {
    opponentValue += 5;
  }
  
  // 垂直方向
  const verticalLine = [
    newBoard[0]?.[move.col],
    newBoard[1]?.[move.col],
    newBoard[2]?.[move.col],
    newBoard[3]?.[move.col]
  ];
  
  const opponentVerticalCount = verticalLine.filter(cell => cell === opponent).length;
  
  if (opponentVerticalCount >= 3) {
    opponentValue += 5;
  }
  
  // 対角線（該当する場合）
  if (move.row === move.col) {
    const diagonal1 = [newBoard[0]?.[0], newBoard[1]?.[1], newBoard[2]?.[2], newBoard[3]?.[3]];
    const opponentDiag1Count = diagonal1.filter(cell => cell === opponent).length;
    
    if (opponentDiag1Count >= 3) {
      opponentValue += 5;
    }
  }
  
  if (move.row + move.col === 3) {
    const diagonal2 = [newBoard[0]?.[3], newBoard[1]?.[2], newBoard[2]?.[1], newBoard[3]?.[0]];
    const opponentDiag2Count = diagonal2.filter(cell => cell === opponent).length;
    
    if (opponentDiag2Count >= 3) {
      opponentValue += 5;
    }
  }
  
  return opponentValue;
}

// 究極の最適手を見つける関数（最強AIのコア）
function findUltimateBestMove(
  board: BoardState,
  player: PlayerType,
  blockRotations: Record<BlockPosition, number>,
  maxRotations: number
): Move | null {
  // 即座に勝てる手は最優先
  const winningMove = findWinningMove(board, player);
  if (winningMove) return winningMove;
  
  // 相手の勝利を阻止する手も優先
  const blockingMove = findBlockingMove(board, player);
  if (blockingMove) return blockingMove;
  
  // 全ての可能な手を取得
  const possibleMoves = getAllPossibleMoves(board);
  if (possibleMoves.length === 0) return null;
  
  // 相手のプレイヤータイプ
  const opponent = player === 'black' ? 'white' : 'black';
  
  // 高度な手の評価を行う
  const evaluatedMoves = possibleMoves.map(move => {
    try {
      const newBoard = board.map(row => row ? [...row] : []);
      if (!newBoard[move.row] || newBoard[move.row][move.col] === undefined) {
        return { move, value: -Infinity };
      }
      
      newBoard[move.row][move.col] = player;
      
      // この手で創出できる戦術的価値の計算
      let tacticalValue = evaluateTacticalValue(newBoard, move, player) * 100;
      
      // 相手の次善手を考慮した評価
      let opponentResponseValue = 0;
      const opponentMoves = getAllPossibleMoves(newBoard);
      
      // 相手の最善手を見つける（ミニマックス的発想）
      let bestOpponentMoveValue = -Infinity;
      
      for (const opMove of opponentMoves) {
        const afterOpponentBoard = newBoard.map(row => row ? [...row] : []);
        if (!afterOpponentBoard[opMove.row] || afterOpponentBoard[opMove.row][opMove.col] === undefined) continue;
        
        afterOpponentBoard[opMove.row][opMove.col] = opponent;
        
        // 相手視点での盤面評価
        const opponentMoveValue = evaluateBoardAdvanced(afterOpponentBoard, opponent);
        
        // 相手にとっての最善手を記録
        if (opponentMoveValue > bestOpponentMoveValue) {
          bestOpponentMoveValue = opponentMoveValue;
        }
      }
      
      // 相手の最善手を評価に反映（相手の良い手は自分にとって不利）
      opponentResponseValue = -bestOpponentMoveValue * 0.8;
      
      // 回転の可能性も考慮
      const blockIndex = getBlockIndexFromPosition(move.row, move.col) as BlockPosition;
      let rotationValue = 0;
      
      if (blockIndex !== null && blockRotations[blockIndex] < maxRotations) {
        // 回転評価を強化（両方向の回転を評価）
        const clockwiseBoard = rotateBlock(newBoard, blockIndex, 'clockwise');
        const counterClockwiseBoard = rotateBlock(newBoard, blockIndex, 'counter-clockwise');
        
        // 回転で勝利できるかチェック
        if (checkWinner(clockwiseBoard) === player || checkWinner(counterClockwiseBoard) === player) {
          rotationValue += 2000; // 回転で即勝利なら超高評価
        }
        
        // 相手の勝利を防げる回転もチェック
        const opponentWinMove = findWinningMove(board, opponent);
        if (opponentWinMove) {
          if ((!isValidMove(clockwiseBoard, opponentWinMove) && checkWinner(clockwiseBoard) !== opponent) || 
              (!isValidMove(counterClockwiseBoard, opponentWinMove) && checkWinner(counterClockwiseBoard) !== opponent)) {
            rotationValue += 1500;
          }
        }
        
        // 回転後の盤面評価（より精密に）
        const clockwiseValue = evaluateBoardAdvanced(clockwiseBoard, player);
        const counterClockwiseValue = evaluateBoardAdvanced(counterClockwiseBoard, player);
        
        // 最良の回転方向の価値を加算
        rotationValue += Math.max(clockwiseValue, counterClockwiseValue) * 1.2;
      }
      
      // 複合評価スコア（より洗練された計算）
      const baseScore = evaluateBoardAdvanced(newBoard, player);
      
      // 総合評価: 基本評価 + 戦術評価 + 回転評価 + 相手の反応評価
      const totalScore = baseScore + tacticalValue + rotationValue + opponentResponseValue;
      
      return { move, value: totalScore };
    } catch (e) {
      console.error("Error evaluating ultimate move:", e);
      return { move, value: -Infinity };
    }
  });
  
  // 評価値でソート
  evaluatedMoves.sort((a, b) => b.value - a.value);
  
  // 上位の手から最良の手を選択
  if (evaluatedMoves.length > 0 && evaluatedMoves[0].value > -Infinity) {
    // 上位3手をランダムに選ぶ可能性を少し入れる（完全な予測不可能性のため）
    if (evaluatedMoves.length >= 3 && Math.random() < 0.1) {
      // 上位3手の中からランダムに選択
      const topIndex = Math.floor(Math.random() * 3);
      return evaluatedMoves[topIndex].move;
    }
    
    // 通常は最良手を選択
    return evaluatedMoves[0].move;
  }
  
  // 万が一評価に失敗した場合のフォールバック
  return findTacticalMove(board, player) || getStrategicMove(board) || getRandomMove(board);
}

// 包括的なボード評価関数（さらに強化した版）
function evaluateBoardComprehensive(board: BoardState, player: PlayerType): number {
  if (!board) return 0;
  
  const opponent = player === 'black' ? 'white' : 'black';
  const winner = checkWinner(board);
  
  // 終局状態の評価
  if (winner === player) {
    return 20000; // 勝利状態は超高評価
  } else if (winner === opponent) {
    return -20000; // 敗北状態は超低評価
  } else if (winner === 'draw') {
    return 0;
  }
  
  // 各種評価指標の重みを調整
  const patternScore = evaluatePatterns(board, player) * 3;
  const centerScore = evaluateCenterControl(board, player) * 2;
  const connectivityScore = evaluateDiscConnectivity(board, player) * 2.5;
  const mobilityScore = evaluateMobility(board, player) * 1.5;
  const threatScore = evaluateThreats(board, player) * 4;
  const blockControlScore = evaluateBlockControl(board, player) * 2.5;
  const winPotentialScore = evaluateAdvancedWinPotential(board, player) * 3; // 名前を変更
  const defensiveScore = evaluateDefensivePosition(board, player) * 3;
  
  // 総合評価
  return patternScore + centerScore + connectivityScore + mobilityScore + 
         threatScore + blockControlScore + winPotentialScore + defensiveScore;
}

// 中央支配の評価（強化版）
function evaluateCenterControl(board: BoardState, player: PlayerType): number {
  if (!board) return 0;
  
  const opponent = player === 'black' ? 'white' : 'black';
  let score = 0;
  
  // 中央のマスの重み付け
  const centerWeights = [
    [3, 4, 4, 3],
    [4, 6, 6, 4],
    [4, 6, 6, 4],
    [3, 4, 4, 3]
  ];
  
  // 各マスを評価
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (!board[row] || board[row][col] === undefined) continue;
      
      if (board[row][col] === player) {
        score += centerWeights[row][col];
      } else if (board[row][col] === opponent) {
        score -= centerWeights[row][col];
      }
    }
  }
  
  return score;
}

// 石の連結性評価（新機能）
function evaluateDiscConnectivity(board: BoardState, player: PlayerType): number {
  if (!board) return 0;
  
  const opponent = player === 'black' ? 'white' : 'black';
  let score = 0;
  
  // 全ての石について隣接する自分の石をカウント
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (board[row] && board[row][col] === player) {
        const adjacentCount = countAdjacentDiscs(board, row, col, player);
        score += adjacentCount * 10;
        
        // 隣接する相手の石も評価（防御的な観点）
        const adjacentOpponentCount = countAdjacentDiscs(board, row, col, opponent);
        if (adjacentOpponentCount > 0) {
          score += 5; // 相手の石に隣接するのも一定の価値がある
        }
      }
    }
  }
  
  return score;
}

// 移動可能性（空きマス）の評価
function evaluateMobility(board: BoardState, player: PlayerType): number {
  const possibleMoves = getAllPossibleMoves(board);
  
  // 自分の手番で動ける場所が多いほど良い
  return possibleMoves.length * 2;
}

// 脅威の評価（勝利に近い状態）
function evaluateThreats(board: BoardState, player: PlayerType): number {
  if (!board) return 0;
  
  const opponent = player === 'black' ? 'white' : 'black';
  let score = 0;
  
  // 水平方向の評価
  for (let row = 0; row < 4; row++) {
    if (!board[row]) continue;
    
    // 3つ連続する可能性をチェック
    for (let col = 0; col <= 1; col++) {
      const line = [board[row][col], board[row][col+1], board[row][col+2], board[row][col+3]];
      
      // 自分の石が3つ、空きが1つの場合は強力な脅威
      const playerCount = line.filter(cell => cell === player).length;
      const emptyCount = line.filter(cell => cell === null).length;
      
      if (playerCount === 3 && emptyCount === 1) {
        score += 100;
      } else if (playerCount === 2 && emptyCount === 2) {
        score += 20; // 2つの石と2つの空きも価値がある
      }
      
      // 相手の脅威も評価
      const opponentCount = line.filter(cell => cell === opponent).length;
      if (opponentCount === 3 && emptyCount === 1) {
        score -= 80; // 相手の脅威は防ぐ必要がある
      }
    }
  }
  
  // 垂直方向の評価
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row <= 1; row++) {
      if (!board[row] || !board[row+1] || !board[row+2] || !board[row+3]) continue;
      
      const line = [board[row][col], board[row+1][col], board[row+2][col], board[row+3][col]];
      
      const playerCount = line.filter(cell => cell === player).length;
      const emptyCount = line.filter(cell => cell === null).length;
      
      if (playerCount === 3 && emptyCount === 1) {
        score += 100;
      } else if (playerCount === 2 && emptyCount === 2) {
        score += 20;
      }
      
      const opponentCount = line.filter(cell => cell === opponent).length;
      if (opponentCount === 3 && emptyCount === 1) {
        score -= 80;
      }
    }
  }
  
  // 対角線の評価
  if (board[0] && board[1] && board[2] && board[3]) {
    // 左上から右下
    const diag1 = [board[0][0], board[1][1], board[2][2], board[3][3]];
    const playerCount1 = diag1.filter(cell => cell === player).length;
    const emptyCount1 = diag1.filter(cell => cell === null).length;
    const opponentCount1 = diag1.filter(cell => cell === opponent).length;
    
    if (playerCount1 === 3 && emptyCount1 === 1) {
      score += 120; // 対角線の脅威はさらに価値が高い
    } else if (playerCount1 === 2 && emptyCount1 === 2) {
      score += 25;
    }
    
    if (opponentCount1 === 3 && emptyCount1 === 1) {
      score -= 100;
    }
    
    // 右上から左下
    const diag2 = [board[0][3], board[1][2], board[2][1], board[3][0]];
    const playerCount2 = diag2.filter(cell => cell === player).length;
    const emptyCount2 = diag2.filter(cell => cell === null).length;
    const opponentCount2 = diag2.filter(cell => cell === opponent).length;
    
    if (playerCount2 === 3 && emptyCount2 === 1) {
      score += 120;
    } else if (playerCount2 === 2 && emptyCount2 === 2) {
      score += 25;
    }
    
    if (opponentCount2 === 3 && emptyCount2 === 1) {
      score -= 100;
    }
  }
  
  return score;
}

// ブロック支配の評価（各ブロックの支配度を評価）
function evaluateBlockControl(board: BoardState, player: PlayerType): number {
  if (!board) return 0;
  
  const opponent = player === 'black' ? 'white' : 'black';
  let score = 0;
  
  // 各ブロックを評価
  const blocks = [0, 1, 2, 3] as BlockPosition[];
  for (const blockIndex of blocks) {
    const cells = getBlockCells(blockIndex);
    
    let playerCount = 0;
    let opponentCount = 0;
    let emptyCount = 0;
    
    for (const [r, c] of cells) {
      if (board[r] && board[r][c] !== undefined) {
        if (board[r][c] === player) {
          playerCount++;
        } else if (board[r][c] === opponent) {
          opponentCount++;
        } else {
          emptyCount++;
        }
      }
    }
    
    // ブロック内の支配度を評価
    if (playerCount === 4) {
      score += 80; // 完全支配
    } else if (playerCount === 3 && emptyCount === 1) {
      score += 40; // 強い支配
    } else if (playerCount === 2 && emptyCount === 2) {
      score += 15; // 中程度の支配
    } else if (playerCount > opponentCount) {
      score += (playerCount - opponentCount) * 5; // 少しの優位
    }
    
    // 相手のブロック支配も評価
    if (opponentCount === 4) {
      score -= 60; // 相手の完全支配
    } else if (opponentCount === 3 && emptyCount === 1) {
      score -= 30; // 相手の強い支配
    }
  }
  
  return score;
}

// 高度な勝利の可能性評価（重複定義エラーを避けるため名前を変更）
function evaluateAdvancedWinPotential(board: BoardState, player: PlayerType): number {
  if (!board) return 0;
  
  let score = 0;
  const possibleMoves = getAllPossibleMoves(board);
  
  // 自分の勝利につながる手を探す
  for (const move of possibleMoves) {
    const testBoard = board.map(row => row ? [...row] : []);
    if (!testBoard[move.row] || testBoard[move.row][move.col] === undefined) continue;
    
    testBoard[move.row][move.col] = player;
    
    // 即座に勝利できる手は高評価
    if (checkWinner(testBoard) === player) {
      score += 1000;
    }
    
    // フォークを作る手を高評価
    const forkValue = evaluateForkPotential(testBoard, move, player);
    if (forkValue > 0) {
      score += forkValue * 50;
    }
  }
  
  return score;
}

// 戦術的価値の評価（複合評価）
function evaluateTacticalValue(board: BoardState, move: Move, player: PlayerType): number {
  try {
    const { row, col } = move;
    if (!board[row] || board[row][col] !== undefined) return 0;
    
    // ブロックインデックスを取得
    const blockIndex = getBlockIndexFromPosition(row, col);
    
    // 戦術的価値を計算
    let value = 0;
    
    // 中央に近い位置は価値が高い
    const centerRow = 4 / 2 - 0.5;
    const centerCol = 4 / 2 - 0.5;
    const distanceFromCenter = Math.sqrt(Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2));
    const centerValue = (4 / 2 - distanceFromCenter) / (4 / 2) * 3;
    value += centerValue;
    
    // ブロック間の戦略的位置
    const blockCenterValue = evaluateBlockPosition(blockIndex);
    value += blockCenterValue;
    
    // 周囲の石をチェック（隣接する自分の石の数）
    const adjacentCount = countAdjacentDiscs(board, row, col, player);
    value += adjacentCount * 1.5;
    
    return value;
  } catch (e) {
    console.error("Error in evaluateTacticalValue:", e);
    return 0;
  }
}

// 回転の可能性評価
function evaluateRotationPotential(
  board: BoardState, 
  move: Move, 
  player: PlayerType,
  blockRotations: Record<BlockPosition, number>,
  maxRotations: number
): number {
  try {
    const { row, col } = move;
    if (!board[row] || board[row][col] !== undefined) return 0;
    
    // ブロックインデックスを取得
    const blockIndex = getBlockIndexFromPosition(row, col) as BlockPosition;
    
    // このブロックがまだ回転可能かチェック
    if (blockRotations[blockIndex] >= maxRotations) {
      return 0; // 回転制限に達している場合は0を返す
    }
    
    // 回転による潜在的な価値を計算
    let rotationValue = 0;
    
    // 1回転後のボードをシミュレート
    const rotatedBoard = simulateRotation(board, blockIndex, 1);
    if (rotatedBoard) {
      const potentialWin = hasWinningLine(rotatedBoard, player);
      if (potentialWin) {
        rotationValue += 10; // 回転で勝てる場合、高い価値
      }
      
      // 相手がこのマスに配置した場合、相手が回転で勝つのを防ぐ
      const opponent = player === 'white' ? 'black' : 'white';
      const testBoard = board.map(row => row ? [...row] : []);
      if (testBoard[row]) testBoard[row][col] = opponent;
      
      const opponentRotatedBoard = simulateRotation(testBoard, blockIndex, 1);
      if (opponentRotatedBoard && hasWinningLine(opponentRotatedBoard, opponent)) {
        rotationValue += 8; // 相手の勝利を防ぐ回転も高価値
      }
    }
    
    return rotationValue;
  } catch (e) {
    console.error("Error in evaluateRotationPotential:", e);
    return 0;
  }
}

// 回転を含めた手の総合評価を強化
function evaluateMoveWithRotation(
  board: BoardState,
  move: Move,
  player: PlayerType,
  blockRotations: Record<BlockPosition, number>,
  maxRotations: number
): number {
  try {
    // 基本的な手の評価
    const newBoard = board.map(row => row ? [...row] : []);
    if (!newBoard[move.row] || newBoard[move.row][move.col] === undefined) {
      return -Infinity;
    }
    
    newBoard[move.row][move.col] = player;
    
    // 高度なボード評価を使用
    const baseScore = evaluateBoardAdvanced(newBoard, player);
    
    // 回転に関連する評価
    const blockIndex = getBlockIndexFromPosition(move.row, move.col) as BlockPosition;
    
    // 回転制限に達していない場合のみ回転評価を加える
    if (blockIndex !== null && blockRotations[blockIndex] < maxRotations) {
      // 時計回りの回転評価
      const clockwiseBoard = rotateBlock(newBoard, blockIndex, 'clockwise');
      const clockwiseScore = evaluateBoardAdvanced(clockwiseBoard, player) * 0.8;
      
      // 反時計回りの回転評価
      const counterClockwiseBoard = rotateBlock(newBoard, blockIndex, 'counter-clockwise');
      const counterClockwiseScore = evaluateBoardAdvanced(counterClockwiseBoard, player) * 0.8;
      
      // 最良の回転評価を使用
      const rotationScore = Math.max(clockwiseScore, counterClockwiseScore);
      
      return baseScore + rotationScore;
    }
    
    return baseScore;
  } catch (e) {
    console.error("Error in evaluateMoveWithRotation:", e);
    return -Infinity;
  }
}

// 回転をシミュレーションする
function simulateRotation(board: BoardState, blockIndex: BlockPosition, direction: number | RotationDirection): BoardState {
  if (!board) return board;
  
  // ボードのコピーを作成
  const newBoard = board.map(row => row ? [...row] : []);
  
  // 方向を正規化
  const rotationDirection: RotationDirection = typeof direction === 'number' 
    ? (direction === 1 ? 'clockwise' : 'counter-clockwise')
    : direction;
  
  // rotateBlock関数を使用
  return rotateBlock(newBoard, blockIndex, rotationDirection);
}

// 全ての可能な回転を取得
function getAllPossibleRotations(blockRotations: Record<BlockPosition, number>, maxRotations: number): Array<{blockIndex: BlockPosition, direction: RotationDirection}> {
  const rotations: Array<{blockIndex: BlockPosition, direction: RotationDirection}> = [];
  
  for (let blockIndex = 0; blockIndex < 4; blockIndex++) {
    if (blockRotations[blockIndex as BlockPosition] < maxRotations) {
      rotations.push({ 
        blockIndex: blockIndex as BlockPosition, 
        direction: 'clockwise' 
      });
      rotations.push({ 
        blockIndex: blockIndex as BlockPosition, 
        direction: 'counter-clockwise' 
      });
    }
  }
  
  return rotations;
}

// AIの回転戦略（現在はランダム）
export function getAIRotation(): { blockIndex: BlockPosition, direction: RotationDirection } {
  return getRandomRotation();
}

// 高速な戦略評価（計算量削減版）
function fastStrategicEvaluation(board: BoardState, player: PlayerType): number {
  if (!board) return 0;
  
  const opponent = player === 'black' ? 'white' : 'black';
  let score = 0;
  
  // 中央の優位性（より計算効率の良い実装）
  const centerPositions = [
    { row: 1, col: 1 }, { row: 1, col: 2 }, 
    { row: 2, col: 1 }, { row: 2, col: 2 }
  ];
  
  for (const pos of centerPositions) {
    if (board[pos.row] && board[pos.row][pos.col] !== undefined) {
      if (board[pos.row][pos.col] === player) {
        score += 15; // 中央の駒はより価値が高い
      } else if (board[pos.row][pos.col] === opponent) {
        score -= 15;
      }
    }
  }
  
  // 勝利につながる可能性のある配置を評価
  score += evaluateWinningPatterns(board, player);
  
  return score;
}

// 勝利パターンの評価（効率化版）
function evaluateWinningPatterns(board: BoardState, player: PlayerType): number {
  if (!board) return 0;
  
  const opponent = player === 'black' ? 'white' : 'black';
  let score = 0;
  
  // 水平方向の3つ並びをチェック
  for (let row = 0; row < 4; row++) {
    if (!board[row]) continue;
    
    for (let col = 0; col <= 1; col++) {
      const cells = [
        board[row][col],
        board[row][col+1],
        board[row][col+2]
      ];
      
      const playerCount = cells.filter(cell => cell === player).length;
      const emptyCount = cells.filter(cell => cell === null).length;
      
      if (playerCount === 2 && emptyCount === 1) {
        score += 30; // 水平方向の2つ並び（勝利に近い）
      }
    }
  }
  
  // 垂直方向の3つ並びをチェック
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row <= 1; row++) {
      if (!board[row] || !board[row+1] || !board[row+2]) continue;
      
      const cells = [
        board[row][col],
        board[row+1][col],
        board[row+2][col]
      ].filter(cell => cell !== undefined);
      
      const playerCount = cells.filter(cell => cell === player).length;
      const emptyCount = cells.filter(cell => cell === null).length;
      
      if (playerCount === 2 && emptyCount === 1) {
        score += 30; // 垂直方向の2つ並び（勝利に近い）
      }
    }
  }
  
  return score;
}

// 回転に関する最適な選択を効率的に見つける
export function getOptimalRotation(
  board: BoardState, 
  player: PlayerType,
  blockRotations: Record<BlockPosition, number>,
  maxRotations: number,
  difficulty: AIDifficulty = 'expert'
): { blockIndex: BlockPosition, direction: RotationDirection } {
  if (difficulty === 'easy') {
    // かんたん：20%の確率で賢い回転、それ以外はランダム
    if (Math.random() < 0.2) {
      const smartRotation = findOptimizedRotation(board, player, blockRotations, maxRotations);
      if (smartRotation) return smartRotation;
    }
    return getAIRotation();
  }
  
  if (difficulty === 'medium') {
    // 普通：40%の確率で勝利/阻止のための回転、それ以外はランダム
    const opponent = player === 'black' ? 'white' : 'black';
    
    // 各回転を試して勝利できるかチェック
    const possibleRotations = getAllPossibleRotations(blockRotations, maxRotations);
    
    if (Math.random() < 0.4) {
      for (const rotation of possibleRotations) {
        const newBoard = getRotatedBoard(board, rotation.blockIndex, rotation.direction);
        
        // この回転で即勝利できる場合
        if (checkWinner(newBoard) === player) {
          return rotation;
        }
        
        // 相手の勝利を阻止できる場合
        const opponentWinningMove = findWinningMove(board, opponent);
        if (opponentWinningMove) {
          const testBoard = getRotatedBoard(board, rotation.blockIndex, rotation.direction);
          if (!isValidMove(testBoard, opponentWinningMove)) {
            return rotation;
          }
        }
      }
    }
    
    return getAIRotation();
  }
  
  if (difficulty === 'hard') {
    // 難しい：60%の確率で戦略的な回転、それ以外はランダム
    const opponent = player === 'black' ? 'white' : 'black';
    
    if (Math.random() < 0.6) {
      // 各回転を試して勝利できるかチェック
      const possibleRotations = getAllPossibleRotations(blockRotations, maxRotations);
      
      for (const rotation of possibleRotations) {
        const newBoard = getRotatedBoard(board, rotation.blockIndex, rotation.direction);
        
        // この回転で即勝利できる場合
        if (checkWinner(newBoard) === player) {
          return rotation;
        }
      }
      
      // 相手の勝利を阻止する回転を探す
      const opponentWinningMove = findWinningMove(board, opponent);
      if (opponentWinningMove) {
        for (const rotation of possibleRotations) {
          const newBoard = getRotatedBoard(board, rotation.blockIndex, rotation.direction);
          
          // 回転後に相手の勝利手が無効になるか
          if (!isValidMove(newBoard, opponentWinningMove)) {
            return rotation;
          }
        }
      }
      
      // 戦略的な回転
      const strategicRotation = findStrategicRotation(board, player, blockRotations, maxRotations);
      if (strategicRotation) {
        return strategicRotation;
      }
    }
    
    // それ以外はランダム
    return getAIRotation();
  }
  
  // 上級モードは高度な回転戦略を90%の確率で選択
  if (difficulty === 'expert') {
    if (Math.random() < 0.9) {
      // 上級モード用の強化された回転戦略
      const expertRotation = findExpertRotation(board, player, blockRotations, maxRotations);
      if (expertRotation) return expertRotation;
      
      // バックアップとして最適化回転を試みる
      const optimalRotation = findOptimizedRotation(board, player, blockRotations, maxRotations);
      if (optimalRotation) return optimalRotation;
    }
    
    // 10%の確率でランダム性を持たせる
    return getAIRotation();
  }
  
  // 最強モードは常にランダムな回転を選択
  if (difficulty === 'master') {
    // 勝利または敗北阻止のみは常に優先する
    const opponent = player === 'black' ? 'white' : 'black';
    const possibleRotations = getAllPossibleRotations(blockRotations, maxRotations);
    
    // 即座に勝てる回転があればそれを選択
    for (const rotation of possibleRotations) {
      const newBoard = getRotatedBoard(board, rotation.blockIndex, rotation.direction);
      if (checkWinner(newBoard) === player) {
        return rotation;
      }
    }
    
    // 敗北回避が必要な場合のみ、それを優先
    const opponentWinningMove = findWinningMove(board, opponent);
    if (opponentWinningMove) {
      for (const rotation of possibleRotations) {
        const newBoard = getRotatedBoard(board, rotation.blockIndex, rotation.direction);
        if (!isValidMove(newBoard, opponentWinningMove)) {
          return rotation;
        }
      }
    }
    
    // それ以外はすべてランダムな回転
    return getAIRotation();
  }
  
  // デフォルトは最適化回転
  return findOptimizedRotation(board, player, blockRotations, maxRotations) || getAIRotation();
}

// 上級モード用の強化された回転戦略
function findExpertRotation(
  board: BoardState,
  player: PlayerType,
  blockRotations: Record<BlockPosition, number>,
  maxRotations: number
): { blockIndex: BlockPosition, direction: RotationDirection } | null {
  const possibleRotations = getAllPossibleRotations(blockRotations, maxRotations);
  
  if (possibleRotations.length === 0) {
    return null;
  }
  
  const opponent = player === 'black' ? 'white' : 'black';
  
  // 勝利できる回転を優先
  for (const rotation of possibleRotations) {
    const newBoard = getRotatedBoard(board, rotation.blockIndex, rotation.direction);
    if (!newBoard) continue;
    
    if (checkWinner(newBoard) === player) {
      return rotation;
    }
  }
  
  // 相手の勝利を阻止する回転も優先
  const opponentWinningMove = findWinningMove(board, opponent);
  if (opponentWinningMove) {
    for (const rotation of possibleRotations) {
      const newBoard = getRotatedBoard(board, rotation.blockIndex, rotation.direction);
      if (!newBoard) continue;
      
      if (!isValidMove(newBoard, opponentWinningMove) || 
          (isValidMove(newBoard, opponentWinningMove) && checkWinner({
            ...newBoard,
            [opponentWinningMove.row]: {
              ...newBoard[opponentWinningMove.row],
              [opponentWinningMove.col]: opponent
            }
          }) !== opponent)) {
        return rotation;
      }
    }
  }
  
  // 高度な評価で回転を選択
  const evaluatedRotations = possibleRotations.map(rotation => {
    const newBoard = getRotatedBoard(board, rotation.blockIndex, rotation.direction);
    if (!newBoard) return { rotation, value: -Infinity };
    
    // 高度な評価関数で回転後の盤面を評価
    let value = evaluateBoardAdvanced(newBoard, player);
    
    // 回転後に有利な手があるかチェック
    const nextMoves = getAllPossibleMoves(newBoard);
    for (const nextMove of nextMoves) {
      const testBoard = newBoard.map(row => row ? [...row] : []);
      if (!testBoard[nextMove.row] || testBoard[nextMove.row][nextMove.col] === undefined) continue;
      
      testBoard[nextMove.row][nextMove.col] = player;
      
      // 次の手で勝てる場合は高評価
      if (checkWinner(testBoard) === player) {
        value += 1000;
      }
      
      // フォークを作れる場合も評価
      const forkValue = evaluateForkPotential(testBoard, nextMove, player);
      if (forkValue > 1) {
        value += forkValue * 80;
      }
    }
    
    // 相手の手も考慮
    for (const opMove of getAllPossibleMoves(newBoard)) {
      const testBoard = newBoard.map(row => row ? [...row] : []);
      if (!testBoard[opMove.row] || testBoard[opMove.row][opMove.col] === undefined) continue;
      
      testBoard[opMove.row][opMove.col] = opponent;
      
      // 相手が次の手で勝てるなら低評価
      if (checkWinner(testBoard) === opponent) {
        value -= 1000;
      }
    }
    
    return { rotation, value };
  });
  
  // 評価値でソート
  evaluatedRotations.sort((a, b) => b.value - a.value);
  
  // 最良の回転を選択
  if (evaluatedRotations.length > 0 && evaluatedRotations[0].value > -Infinity) {
    return evaluatedRotations[0].rotation;
  }
  
  return null;
}

// 効率的な最適回転の選択（計算量を削減）
function findOptimizedRotation(
  board: BoardState,
  player: PlayerType,
  blockRotations: Record<BlockPosition, number>,
  maxRotations: number
): { blockIndex: BlockPosition, direction: RotationDirection } | null {
  const possibleRotations = getAllPossibleRotations(blockRotations, maxRotations);
  
  if (possibleRotations.length === 0) {
    return null;
  }
  
  let bestRotation: { blockIndex: BlockPosition, direction: RotationDirection } | null = null;
  let bestValue = -Infinity;
  
  const opponent = player === 'black' ? 'white' : 'black';
  
  // 各回転を評価
  for (const rotation of possibleRotations) {
    const newBoard = getRotatedBoard(board, rotation.blockIndex, rotation.direction);
    if (!newBoard) continue;
    
    // 回転で即勝利できるなら最優先
    if (checkWinner(newBoard) === player) {
      return rotation;
    }
    
    // 回転評価（強化版）
    let evalValue = evaluateBoardAdvanced(newBoard, player);
    
    // 相手の次の一手をチェック
    const opponentMove = findWinningMove(newBoard, opponent);
    if (opponentMove) {
      // 相手が次の手で勝てる場合、評価を下げる
      evalValue -= 1000;
    }
    
    // 回転後に良いフォークができるかチェック
    const possibleMoves = getAllPossibleMoves(newBoard);
    for (const move of possibleMoves) {
      const testBoard = newBoard.map(row => row ? [...row] : []);
      if (!testBoard[move.row] || testBoard[move.row][move.col] === undefined) continue;
      
      testBoard[move.row][move.col] = player;
      
      const forkValue = evaluateForkPotential(testBoard, move, player);
      if (forkValue > 0) {
        evalValue += forkValue * 50; // フォークができる回転は高評価
      }
    }
    
    if (evalValue > bestValue) {
      bestValue = evalValue;
      bestRotation = rotation;
    }
  }
  
  return bestRotation;
}

// 戦略的な回転を見つける（難易度hard用）
function findStrategicRotation(
  board: BoardState,
  player: PlayerType,
  blockRotations: Record<BlockPosition, number>,
  maxRotations: number
): { blockIndex: BlockPosition, direction: RotationDirection } | null {
  const possibleRotations = getAllPossibleRotations(blockRotations, maxRotations);
  
  if (possibleRotations.length === 0) {
    return null;
  }
  
  let bestRotation: { blockIndex: BlockPosition, direction: RotationDirection } | null = null;
  let bestValue = -Infinity;
  
  for (const rotation of possibleRotations) {
    const newBoard = getRotatedBoard(board, rotation.blockIndex, rotation.direction);
    if (!newBoard) continue;
    
    // パターン評価をベースにした簡易評価
    const evalValue = evaluatePatterns(newBoard, player);
    
    if (evalValue > bestValue) {
      bestValue = evalValue;
      bestRotation = rotation;
    }
  }
  
  return bestValue > 0 ? bestRotation : null;
}

// 最強モードのための高度な回転戦略を改善
function findMasterRotation(
  board: BoardState,
  player: PlayerType,
  blockRotations: Record<BlockPosition, number>,
  maxRotations: number
): { blockIndex: BlockPosition, direction: RotationDirection } | null {
  const possibleRotations = getAllPossibleRotations(blockRotations, maxRotations);
  
  if (possibleRotations.length === 0) {
    return null;
  }
  
  const opponent = player === 'black' ? 'white' : 'black';
  
  // ステップ1: 勝利できる回転を探す（最優先）
  for (const rotation of possibleRotations) {
    const newBoard = getRotatedBoard(board, rotation.blockIndex, rotation.direction);
    if (!newBoard) continue;
    
    if (checkWinner(newBoard) === player) {
      return rotation;
    }
  }
  
  // ステップ2: 相手の勝利を阻止する回転を探す（次に優先）
  const opponentWinningMove = findWinningMove(board, opponent);
  if (opponentWinningMove) {
    for (const rotation of possibleRotations) {
      const newBoard = getRotatedBoard(board, rotation.blockIndex, rotation.direction);
      if (!newBoard) continue;
      
      // 回転後に相手の勝利手が無効になるか、または勝てなくなるか
      if (!isValidMove(newBoard, opponentWinningMove) || 
          (isValidMove(newBoard, opponentWinningMove) && checkWinner({
            ...newBoard,
            [opponentWinningMove.row]: {
              ...newBoard[opponentWinningMove.row],
              [opponentWinningMove.col]: opponent
            }
          }) !== opponent)) {
        return rotation;
      }
    }
  }
  
  // ステップ3: さらに高度な評価で最適な回転を選択
  const evaluatedRotations = possibleRotations.map(rotation => {
    const newBoard = getRotatedBoard(board, rotation.blockIndex, rotation.direction);
    if (!newBoard) return { rotation, value: -Infinity };
    
    // 回転後のボードを高度な評価関数で評価
    let value = evaluateBoardAdvanced(newBoard, player);
    
    // 回転後に自分の有利な手ができるかチェック
    const myNextMoves = getAllPossibleMoves(newBoard);
    let bestMoveValue = -Infinity;
    
    for (const nextMove of myNextMoves) {
      const testBoard = newBoard.map(row => row ? [...row] : []);
      if (!testBoard[nextMove.row] || testBoard[nextMove.row][nextMove.col] === undefined) continue;
      
      testBoard[nextMove.row][nextMove.col] = player;
      
      // 次の手の価値を評価
      const moveValue = evaluateBoardAdvanced(testBoard, player);
      if (moveValue > bestMoveValue) {
        bestMoveValue = moveValue;
      }
      
      // 次の手で勝てる場合は超高評価
      if (checkWinner(testBoard) === player) {
        value += 2000;
      }
      
      // フォークができる場合も高評価
      const forkValue = evaluateForkPotential(testBoard, nextMove, player);
      if (forkValue > 1) {
        value += forkValue * 100;
      }
    }
    
    // 最善の次の一手の価値を加算
    if (bestMoveValue > -Infinity) {
      value += bestMoveValue * 0.5;
    }
    
    // 相手の次の一手についても評価
    const opponentMoves = getAllPossibleMoves(newBoard);
    for (const opMove of opponentMoves) {
      const testBoard = newBoard.map(row => row ? [...row] : []);
      if (!testBoard[opMove.row] || testBoard[opMove.row][opMove.col] === undefined) continue;
      
      testBoard[opMove.row][opMove.col] = opponent;
      
      // 相手が次の手で勝てるなら低評価
      if (checkWinner(testBoard) === opponent) {
        value -= 1500;
      }
      
      // 相手がフォークを作れるなら低評価
      const opponentFork = evaluateForkPotential(testBoard, opMove, opponent);
      if (opponentFork > 1) {
        value -= opponentFork * 80;
      }
    }
    
    return { rotation, value };
  });
  
  // 評価値でソート
  evaluatedRotations.sort((a, b) => b.value - a.value);
  
  // 最良の回転を選択
  if (evaluatedRotations.length > 0 && evaluatedRotations[0].value > -Infinity) {
    // 少しだけランダム性を入れる（僅差なら別の選択肢も）
    if (evaluatedRotations.length >= 2 && 
        evaluatedRotations[0].value - evaluatedRotations[1].value < 100 &&
        Math.random() < 0.15) {
      return evaluatedRotations[1].rotation;
    }
    
    return evaluatedRotations[0].rotation;
  }
  
  return null;
}

// ブロックの位置を評価する関数
function evaluateBlockPosition(blockIndex: BlockPosition): number {
  // 戦略的な観点からブロックの位置の重要度を評価
  // 中央に近いブロックはより価値が高い
  switch (blockIndex) {
    case 0: return 2; // 左上
    case 1: return 2; // 右上
    case 2: return 2; // 左下
    case 3: return 2; // 右下
    default: return 0;
  }
}

// 隣接する同じ色の石の数を数える
function countAdjacentDiscs(board: BoardState, row: number, col: number, player: PlayerType): number {
  if (!board || !board[row] || board[row][col] === undefined) return 0;
  
  let count = 0;
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  
  for (const [dr, dc] of directions) {
    const newRow = row + dr;
    const newCol = col + dc;
    
    if (newRow >= 0 && newRow < 4 && newCol >= 0 && newCol < 4 &&
        board[newRow] && board[newRow][newCol] === player) {
      count++;
    }
  }
  
  return count;
}

// 回転後のボードを計算
function getRotatedBoard(
  board: BoardState, 
  blockIndex: BlockPosition, 
  direction: RotationDirection
): BoardState {
  return rotateBlock(board, blockIndex, direction);
}

// 勝利ラインがあるかチェックする
function hasWinningLine(board: BoardState, player: PlayerType): boolean {
  if (!board) return false;
  
  // 水平方向のチェック
  for (let row = 0; row < 4; row++) {
    if (!board[row]) continue;
    
    for (let col = 0; col <= 0; col++) {
      if (
        board[row][col] === player &&
        board[row][col+1] === player &&
        board[row][col+2] === player &&
        board[row][col+3] === player
      ) {
        return true;
      }
    }
  }
  
  // 垂直方向のチェック
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row <= 0; row++) {
      if (
        board[row] && board[row+1] && board[row+2] && board[row+3] &&
        board[row][col] === player &&
        board[row+1][col] === player &&
        board[row+2][col] === player &&
        board[row+3][col] === player
      ) {
        return true;
      }
    }
  }
  
  // 対角線方向のチェック (左上から右下)
  if (
    board[0] && board[1] && board[2] && board[3] &&
    board[0][0] === player &&
    board[1][1] === player &&
    board[2][2] === player &&
    board[3][3] === player
  ) {
    return true;
  }
  
  // 対角線方向のチェック (右上から左下)
  if (
    board[0] && board[1] && board[2] && board[3] &&
    board[0][3] === player &&
    board[1][2] === player &&
    board[2][1] === player &&
    board[3][0] === player
  ) {
    return true;
  }
  
  return false;
}

// 窓の評価関数
function evaluateWindow(cells: Array<PlayerType | null>, player: PlayerType, opponent: PlayerType): number {
  const playerCount = cells.filter(cell => cell === player).length;
  const opponentCount = cells.filter(cell => cell === opponent).length;
  const emptyCount = cells.filter(cell => cell === null).length;
  
  // 勝利条件: 3つの同じ色の駒が並んだ場合
  if (playerCount === 3 && emptyCount === 0) {
    return 100;
  } else if (opponentCount === 3 && emptyCount === 0) {
    return -100;
  }
  
  // 有利条件: 2つの駒と1つの空きマス
  if (playerCount === 2 && emptyCount === 1) {
    return 10;
  } else if (opponentCount === 2 && emptyCount === 1) {
    return -10;
  }
  
  // 少し有利: 1つの駒と2つの空きマス
  if (playerCount === 1 && emptyCount === 2) {
    return 1;
  } else if (opponentCount === 1 && emptyCount === 2) {
    return -1;
  }
  
  return 0;
}

// パターンベースの評価関数
function evaluatePatterns(board: BoardState, player: PlayerType): number {
  if (!board) return 0;
  
  const opponent = player === 'black' ? 'white' : 'black';
  let score = 0;
  
  // 水平方向の評価
  for (let row = 0; row < 4; row++) {
    if (!board[row]) continue;
    
    for (let col = 0; col <= 1; col++) {
      const window = [
        board[row][col],
        board[row][col + 1],
        board[row][col + 2],
        board[row][col + 3]
      ].filter(cell => cell !== undefined);
      
      if (window.length === 4) {
        score += evaluateWindow(window, player, opponent);
      }
    }
  }
  
  // 垂直方向の評価
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row <= 1; row++) {
      if (!board[row] || !board[row+1] || !board[row+2] || !board[row+3]) continue;
      
      const window = [
        board[row][col],
        board[row + 1][col],
        board[row + 2][col],
        board[row + 3][col]
      ].filter(cell => cell !== undefined);
      
      if (window.length === 4) {
        score += evaluateWindow(window, player, opponent);
      }
    }
  }
  
  // 対角線方向の評価
  const diagonals = [];
  
  if (board[0] && board[1] && board[2] && board[3]) {
    if (board[0][0] !== undefined && board[1][1] !== undefined && 
        board[2][2] !== undefined && board[3][3] !== undefined) {
      diagonals.push([board[0][0], board[1][1], board[2][2], board[3][3]]);
    }
    
    if (board[0][3] !== undefined && board[1][2] !== undefined && 
        board[2][1] !== undefined && board[3][0] !== undefined) {
      diagonals.push([board[0][3], board[1][2], board[2][1], board[3][0]]);
    }
  }
  
  for (const diagonal of diagonals) {
    score += evaluateWindow(diagonal, player, opponent) * 1.5;
  }
  
  return score;
}

// 高度なボード評価関数を改善
function evaluateBoardAdvanced(board: BoardState, player: PlayerType): number {
  if (!board) return 0;
  
  const opponent = player === 'black' ? 'white' : 'black';
  const winner = checkWinner(board);
  
  // 終局状態の評価
  if (winner === player) {
    return 10000; // 勝利状態は非常に高い評価
  } else if (winner === opponent) {
    return -10000; // 敗北状態は非常に低い評価
  } else if (winner === 'draw') {
    return 0;
  }
  
  // パターンベースの評価
  const patternScore = evaluatePatterns(board, player) * 2;
  
  // 中央の支配評価
  let centerScore = 0;
  const centerPositions = [
    { row: 1, col: 1 }, { row: 1, col: 2 }, 
    { row: 2, col: 1 }, { row: 2, col: 2 }
  ];
  
  for (const pos of centerPositions) {
    if (board[pos.row] && board[pos.row][pos.col] !== undefined) {
      if (board[pos.row][pos.col] === player) {
        centerScore += 30; // 中央マスの価値を高く設定
      } else if (board[pos.row][pos.col] === opponent) {
        centerScore -= 25; // 相手の中央マスも評価
      }
    }
  }
  
  // コーナー評価
  let cornerScore = 0;
  const cornerPositions = [
    { row: 0, col: 0 }, { row: 0, col: 3 },
    { row: 3, col: 0 }, { row: 3, col: 3 }
  ];
  
  for (const pos of cornerPositions) {
    if (board[pos.row] && board[pos.row][pos.col] !== undefined) {
      if (board[pos.row][pos.col] === player) {
        cornerScore += 15;
      } else if (board[pos.row][pos.col] === opponent) {
        cornerScore -= 10;
      }
    }
  }
  
  // 戦略的な配置パターン評価
  const strategicScore = evaluateStrategicPatterns(board, player) * 1.5;
  
  // 勝利の可能性評価
  const winPotentialScore = evaluateWinPotential(board, player) * 3;
  
  // 防御的評価
  const defensiveScore = evaluateDefensivePosition(board, player) * 2;
  
  // 総合スコア
  return patternScore + centerScore + cornerScore + strategicScore + winPotentialScore + defensiveScore;
}

// 戦略的なパターン評価（連結パターンなど）
function evaluateStrategicPatterns(board: BoardState, player: PlayerType): number {
  if (!board) return 0;
  
  const opponent = player === 'black' ? 'white' : 'black';
  let score = 0;
  
  // ブロック（2x2領域）内での駒の集中度評価
  const blocks = [0, 1, 2, 3] as BlockPosition[];
  for (const blockIndex of blocks) {
    const cells = getBlockCells(blockIndex);
    let playerCount = 0;
    let opponentCount = 0;
    
    for (const [r, c] of cells) {
      if (board[r] && board[r][c] !== undefined) {
        if (board[r][c] === player) {
          playerCount++;
        } else if (board[r][c] === opponent) {
          opponentCount++;
        }
      }
    }
    
    // 同じブロック内に自分の駒が多いほど有利
    if (playerCount > opponentCount) {
      score += (playerCount - opponentCount) * 10;
    } else if (opponentCount > playerCount) {
      score -= (opponentCount - playerCount) * 8;
    }
    
    // 完全に支配されたブロックはさらに価値が高い
    if (playerCount === 4) {
      score += 50;
    } else if (opponentCount === 4) {
      score -= 40;
    }
  }
  
  // 隣接する駒のパターン評価
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (board[row] && board[row][col] === player) {
        // 隣接する同じ色の駒を評価
        const adjacentCount = countAdjacentDiscs(board, row, col, player);
        score += adjacentCount * 5; // 隣接する駒が多いほど強い
      }
    }
  }
  
  return score;
}

// 防御的位置の評価
function evaluateDefensivePosition(board: BoardState, player: PlayerType): number {
  if (!board) return 0;
  
  const opponent = player === 'black' ? 'white' : 'black';
  let score = 0;
  
  // 相手の勝利につながる可能性のある場所をブロックする価値
  const opponentWinningMove = findWinningMove(board, opponent);
  if (opponentWinningMove) {
    score += 200; // 相手の勝利阻止は高価値
  }
  
  // 相手のフォークを防ぐ評価
  const possibleMoves = getAllPossibleMoves(board);
  for (const move of possibleMoves) {
    const testBoard = board.map(row => row ? [...row] : []);
    if (!testBoard[move.row] || testBoard[move.row][move.col] === undefined) continue;
    
    testBoard[move.row][move.col] = player;
    
    // この手で相手のフォークを防げるか評価
    const blockValue = preventOpponentFork(board, move, player);
    score += blockValue * 30;
  }
  
  return score;
}

// 勝利の可能性評価を改善
function evaluateWinPotential(board: BoardState, player: PlayerType): number {
  if (!board) return 0;
  
  let score = 0;
  const possibleMoves = getAllPossibleMoves(board);
  
  // 自分の勝利につながる手を探す
  for (const move of possibleMoves) {
    const testBoard = board.map(row => row ? [...row] : []);
    if (!testBoard[move.row] || testBoard[move.row][move.col] === undefined) continue;
    
    testBoard[move.row][move.col] = player;
    
    // 即座に勝利できる手は高評価
    if (checkWinner(testBoard) === player) {
      score += 1000;
    }
    
    // フォークを作る手を高評価
    const forkValue = evaluateForkPotential(testBoard, move, player);
    if (forkValue > 0) {
      score += forkValue * 50;
    }
  }
  
  return score;
}

// コンピューターの手を決定する関数
export function getComputerMoveWithDifficulty(board: BoardState, playerType: PlayerType, difficulty: AIDifficulty): Move | null {
  try {
    // 難易度に応じた戦略を使用
    switch (difficulty) {
      case 'easy':
        return getRandomMove(board);
      case 'medium':
        return getStrategicMove(board);
      case 'hard':
        return getStrategicMove(board);
      case 'expert':
        return getMiniMaxMove(board);
      case 'master':
        return getMiniMaxMove(board);
      default:
        return getRandomMove(board);
    }
  } catch (e) {
    console.error("AI move calculation error:", e);
    return getRandomMove(board);
  }
}

// 未実装の simulateMove 関数を実装
function simulateMove(board: BoardState, move: Move): BoardState {
  const newBoard = board.map(row => row ? [...row] : []);
  if (newBoard[move.row] && newBoard[move.row][move.col] !== undefined) {
    newBoard[move.row][move.col] = 'black'; // デフォルト値として黒を設定
  }
  return newBoard;
}

// getMiniMaxMove 関数の実装
function getMiniMaxMove(board: BoardState, player: PlayerType = 'white', depth: number = 4): Move | null {
  return findBestMove(board, player, depth);
} 