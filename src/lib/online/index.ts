import { io, Socket } from 'socket.io-client';
import { GameState, Move, OnlineGameState, PlayerType, Rotation } from '@/types';

// ソケット接続状態の型
export type SocketStatus = 'disconnected' | 'connecting' | 'connected';

// ソケットイベントの型
export interface SocketEvents {
  onConnect: () => void;
  onDisconnect: () => void;
  onError: (error: any) => void;
  onGameState: (gameState: OnlineGameState) => void;
  onJoinGame: (gameId: string, playerId: string, playerType: PlayerType | 'spectator') => void;
  onGameNotFound: () => void;
  onGameFull: () => void;
}

// ソケットクライアントクラス
export class SocketClient {
  private socket: Socket | null = null;
  private status: SocketStatus = 'disconnected';
  private events: SocketEvents;
  private gameId: string | null = null;
  private playerId: string | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private isConnecting = false;
  
  constructor(events: SocketEvents) {
    this.events = events;
  }
  
  // ソケット接続を初期化
  public connect(): void {
    if (this.socket) {
      return;
    }
    
    this.status = 'connecting';
    this.reconnectAttempts = 0;
    
    // Socket.ioクライアントを作成
    this.connectWithFallback();
  }
  
  // フォールバック接続ロジック
  private connectWithFallback(): void {
    if (this.isConnecting) return;
    this.isConnecting = true;
    
    // 既存の接続があれば閉じる
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    // サーバーURL（同じオリジン）
    const serverUrl = window.location.origin;
    
    // ログ
    console.log(`Socket.IOサーバーに接続しています: ${serverUrl}`);
    
    try {
      // 接続オプション
      this.socket = io(serverUrl, {
        path: '/api/socketio', // 正しいAPIルートパス
        transports: ['polling', 'websocket'],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        timeout: 20000,
        autoConnect: true,
        forceNew: true,
      });
      
      // イベントリスナーを設定
      this.setupEventListeners();
      
      // 接続エラーハンドリング
      this.socket.on('connect_error', (error) => {
        console.error('Socket.IO接続エラー:', error);
        this.isConnecting = false;
        
        // 開発環境では接続エラーを表示
        this.events.onError(`Socket.IOサーバーに接続できません: ${error.message}`);
        this.status = 'disconnected';
      });
    } catch (error) {
      console.error('Socket初期化エラー:', error);
      this.events.onError(`Socket初期化エラー: ${(error as Error).message}`);
      this.status = 'disconnected';
      this.isConnecting = false;
    }
  }
  
  // ソケットイベントリスナーを設定
  private setupEventListeners(): void {
    if (!this.socket) return;
    
    this.socket.on('connect', () => {
      console.log('Socket connected successfully');
      this.status = 'connected';
      this.events.onConnect();
      
      if (this.gameId && this.playerId) {
        // 再接続時に自動的にゲームに再参加
        this.joinGame(this.gameId, this.playerId, 'black');
      }
    });
    
    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.status = 'disconnected';
      this.events.onDisconnect();
    });
    
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.events.onError(error);
    });
    
    this.socket.on('gameState', (gameState: OnlineGameState) => {
      this.events.onGameState(gameState);
    });
    
    this.socket.on('joinGame', ({ gameId, playerId, playerType }) => {
      console.log(`Joined game: ${gameId} as ${playerType}`);
      this.gameId = gameId;
      this.playerId = playerId;
      this.events.onJoinGame(gameId, playerId, playerType);
    });
    
    this.socket.on('gameNotFound', () => {
      console.log('Game not found');
      this.events.onGameNotFound();
    });
    
    this.socket.on('gameFull', () => {
      console.log('Game is full');
      this.events.onGameFull();
    });
  }
  
  // ソケットをクリーンアップ
  private cleanupSocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }
  
  // ソケット接続を切断
  public disconnect(): void {
    this.cleanupSocket();
    this.status = 'disconnected';
    this.gameId = null;
    this.playerId = null;
    this.reconnectAttempts = 0;
  }
  
  // 新しいゲームを作成
  public createGame(): void {
    if (!this.socket || this.status !== 'connected') {
      this.events.onError('サーバーに接続されていません。再接続を試みてください。');
      return;
    }
    
    this.socket.emit('createGame');
  }
  
  // ゲームに参加
  public joinGame(gameId: string, playerId: string, playerType: PlayerType | 'spectator'): void {
    if (!this.socket || this.status !== 'connected') {
      this.events.onError('サーバーに接続されていません。再接続を試みてください。');
      return;
    }
    
    this.socket.emit('joinGame', { gameId, playerId, playerType });
  }
  
  // 駒を配置
  public placeDisc(move: Move): void {
    if (!this.socket || this.status !== 'connected' || !this.gameId || !this.playerId) {
      this.events.onError('サーバーに接続されていないか、ゲームに参加していません。');
      return;
    }
    
    this.socket.emit('placeDisc', { gameId: this.gameId, playerId: this.playerId, move });
  }
  
  // ブロックを回転
  public rotateBlock(rotation: Rotation): void {
    if (!this.socket || this.status !== 'connected' || !this.gameId || !this.playerId) {
      this.events.onError('サーバーに接続されていないか、ゲームに参加していません。');
      return;
    }
    
    this.socket.emit('rotateBlock', { gameId: this.gameId, playerId: this.playerId, rotation });
  }
  
  // ゲームをリセット
  public resetGame(): void {
    if (!this.socket || this.status !== 'connected' || !this.gameId || !this.playerId) {
      this.events.onError('サーバーに接続されていないか、ゲームに参加していません。');
      return;
    }
    
    this.socket.emit('resetGame', { gameId: this.gameId, playerId: this.playerId });
  }
  
  // ゲームから退出
  public leaveGame(): void {
    if (!this.socket || this.status !== 'connected' || !this.gameId || !this.playerId) {
      return;
    }
    
    this.socket.emit('leaveGame', { gameId: this.gameId, playerId: this.playerId });
    this.gameId = null;
    this.playerId = null;
  }
  
  // 接続状態を取得
  public getStatus(): SocketStatus {
    return this.status;
  }
  
  // 現在のゲームIDを取得
  public getGameId(): string | null {
    return this.gameId;
  }
  
  // 現在のプレイヤーIDを取得
  public getPlayerId(): string | null {
    return this.playerId;
  }
} 