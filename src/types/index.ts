export type PlayerType = 'black' | 'white';
export type CellState = PlayerType | null;
export type BoardState = CellState[][];
export type BlockPosition = 0 | 1 | 2 | 3;
export type RotationDirection = 'clockwise' | 'counter-clockwise';

export type GameMode = 'pvp' | 'pve' | 'online';
export type RotationMode = 'manual' | 'auto';
export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'master';

export interface GameSettings {
  gameMode: GameMode;
  aiDifficulty: AIDifficulty;
  soundEnabled: boolean;
  rotationMode?: RotationMode;
  soundTheme?: string;
  difficulty?: AIDifficulty;
  boardSize?: number; // 例：3 (3x3ブロック)
  blockSize?: number; // 例：3 (3x3マス)
  player1Type?: PlayerType;
  player2Type?: PlayerType;
}

export interface GameState {
  board: BoardState;
  currentPlayer: PlayerType;
  winner: PlayerType | 'draw' | null;
  blockRotations: Record<BlockPosition, number>;
  maxRotations: number;
  lastMove: {
    row: number;
    col: number;
    player: PlayerType;
  } | null;
  lastRotation: {
    blockIndex: BlockPosition;
    direction: RotationDirection;
  } | null;
  isGameOver: boolean;
  isProcessingMove: boolean;
  settings: GameSettings;
}

export interface OnlineGameState extends GameState {
  gameId: string;
  players: {
    black: string;
    white: string | null;
  };
  spectators: string[];
  isWaiting: boolean;
}

export interface Move {
  row: number;
  col: number;
}

export interface Rotation {
  blockIndex: BlockPosition;
  direction: RotationDirection;
}

export interface SoundEffect {
  placement: string;
  rotation: string;
  win: string;
  draw: string;
  reset: string;
}

export interface SoundTheme {
  name: string;
  effects: SoundEffect;
} 