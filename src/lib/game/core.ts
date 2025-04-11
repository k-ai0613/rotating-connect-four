import { BoardState, PlayerType, BlockPosition, RotationDirection, Move, Rotation } from '@/types';

// 4x4のボードを初期化
export function initializeBoard(): BoardState {
  return Array(4).fill(null).map(() => Array(4).fill(null));
}

// 指定した位置に駒を配置できるかチェック
export function isValidMove(board: BoardState, move: Move): boolean {
  const { row, col } = move;
  return row >= 0 && row < 4 && col >= 0 && col < 4 && board[row][col] === null;
}

// 駒を配置
export function placeDisc(board: BoardState, move: Move, player: PlayerType): BoardState {
  if (!isValidMove(board, move)) {
    return board;
  }
  
  const newBoard = board.map(row => [...row]);
  newBoard[move.row][move.col] = player;
  return newBoard;
}

// 2x2のブロックを取得 (0: 左上, 1: 右上, 2: 左下, 3: 右下)
export function getBlock(board: BoardState, blockIndex: BlockPosition): CellBlock {
  const startRow = Math.floor(blockIndex / 2) * 2;
  const startCol = (blockIndex % 2) * 2;
  
  return {
    cells: [
      [board[startRow][startCol], board[startRow][startCol + 1]],
      [board[startRow + 1][startCol], board[startRow + 1][startCol + 1]]
    ],
    position: {
      startRow,
      startCol
    }
  };
}

// ブロックの位置情報を含む型
interface CellBlock {
  cells: BoardState;
  position: {
    startRow: number;
    startCol: number;
  };
}

// ブロックを回転
export function rotateBlock(
  board: BoardState,
  blockIndex: BlockPosition,
  direction: RotationDirection
): BoardState {
  const block = getBlock(board, blockIndex);
  const { cells, position } = block;
  const { startRow, startCol } = position;
  
  // 新しいボード状態をコピー
  const newBoard = board.map(row => [...row]);
  
  if (direction === 'clockwise') {
    // 時計回り
    newBoard[startRow][startCol] = cells[1][0];
    newBoard[startRow][startCol + 1] = cells[0][0];
    newBoard[startRow + 1][startCol] = cells[1][1];
    newBoard[startRow + 1][startCol + 1] = cells[0][1];
  } else {
    // 反時計回り
    newBoard[startRow][startCol] = cells[0][1];
    newBoard[startRow][startCol + 1] = cells[1][1];
    newBoard[startRow + 1][startCol] = cells[0][0];
    newBoard[startRow + 1][startCol + 1] = cells[1][0];
  }
  
  return newBoard;
}

// 勝者をチェック (4つ並んだかどうか)
export function checkWinner(board: BoardState): PlayerType | 'draw' | null {
  // 行をチェック
  for (let row = 0; row < 4; row++) {
    if (
      board[row][0] !== null &&
      board[row][0] === board[row][1] &&
      board[row][1] === board[row][2] &&
      board[row][2] === board[row][3]
    ) {
      return board[row][0];
    }
  }
  
  // 列をチェック
  for (let col = 0; col < 4; col++) {
    if (
      board[0][col] !== null &&
      board[0][col] === board[1][col] &&
      board[1][col] === board[2][col] &&
      board[2][col] === board[3][col]
    ) {
      return board[0][col];
    }
  }
  
  // 対角線をチェック (左上から右下)
  if (
    board[0][0] !== null &&
    board[0][0] === board[1][1] &&
    board[1][1] === board[2][2] &&
    board[2][2] === board[3][3]
  ) {
    return board[0][0];
  }
  
  // 対角線をチェック (右上から左下)
  if (
    board[0][3] !== null &&
    board[0][3] === board[1][2] &&
    board[1][2] === board[2][1] &&
    board[2][1] === board[3][0]
  ) {
    return board[0][3];
  }
  
  // ボードが埋まっているかチェック (引き分け)
  const isBoardFull = board.every(row => row.every(cell => cell !== null));
  if (isBoardFull) {
    return 'draw';
  }
  
  // まだ勝者がいない
  return null;
}

// ランダムなブロックインデックスを生成
export function getRandomBlockIndex(): BlockPosition {
  return Math.floor(Math.random() * 4) as BlockPosition;
}

// ランダムな回転方向を生成
export function getRandomRotationDirection(): RotationDirection {
  return Math.random() > 0.5 ? 'clockwise' : 'counter-clockwise';
}

// 自動回転のためのランダムな回転を生成
export function getRandomRotation(): Rotation {
  return {
    blockIndex: getRandomBlockIndex(),
    direction: getRandomRotationDirection()
  };
}

// 駒の位置から該当する2x2ブロックのインデックスを特定
export function getBlockIndexFromPosition(row: number, col: number): BlockPosition {
  // ブロックインデックスの計算
  // 0: 左上 (0,0)-(1,1), 1: 右上 (0,2)-(1,3)
  // 2: 左下 (2,0)-(3,1), 3: 右下 (2,2)-(3,3)
  const blockRow = Math.floor(row / 2);
  const blockCol = Math.floor(col / 2);
  
  // 修正：正しい計算式に変更（blockRow * 2ではなく）
  return (blockRow * 2 + blockCol) as BlockPosition;
} 