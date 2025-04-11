import { Server as NetServer } from 'http';
import { NextApiRequest } from 'next';
import { Server as ServerIO } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { NextRequest, NextResponse } from 'next/server';
import { 
  GameState, 
  OnlineGameState, 
  Move, 
  Rotation, 
  PlayerType,
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
} from '@/lib/game/core';
import { NextApiResponseServerIO } from '@/types/next';

// オンラインゲームの状態を管理するマップ
const games = new Map<string, OnlineGameState>();

// ゲームIDからそのゲームに接続中のソケットIDを管理するマップ
const gameToSockets = new Map<string, Set<string>>();

// ソケットIDからそのソケットが参加しているゲームIDを管理するマップ
const socketToGame = new Map<string, string>();

// Socket.ioサーバーのインスタンス
let io: ServerIO | null = null;

export const dynamic = 'force-dynamic';

// サーバー変数をexportしない
// @ts-ignore
const globalServer = global.server || {};

// Socket.ioサーバーが既に存在するかチェック
// @ts-ignore
if (!global.server) {
  // @ts-ignore
  global.server = {
    initialized: false,
  };
}

function ensureIOServer() {
  // @ts-ignore
  if (!global.server.initialized) {
    // サーバーが未初期化の場合は新しく作成
    const httpServer = new NetServer();

    io = new ServerIO(httpServer, {
      path: '/api/socketio',
      addTrailingSlash: false,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['polling', 'websocket'],
    });

    // ソケット接続イベントの処理
    io?.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // 新しいゲーム作成
      socket.on('createGame', () => {
        const gameId = uuidv4();
        const playerId = socket.id;
        
        // 初期ゲーム状態を作成
        const initialState: OnlineGameState = {
          gameId,
          board: initializeBoard(),
          currentPlayer: 'black',
          winner: null,
          blockRotations: {
            0: 0,
            1: 0,
            2: 0,
            3: 0
          },
          maxRotations: 3,
          lastMove: null,
          lastRotation: null,
          isGameOver: false,
          settings: {
            gameMode: 'online',
            rotationMode: 'manual',
            aiDifficulty: 'medium',
            soundEnabled: true,
            soundTheme: 'default'
          },
          players: {
            black: playerId,
            white: null
          },
          spectators: [],
          isWaiting: true,
          isProcessingMove: false
        };
        
        // ゲーム状態を保存
        games.set(gameId, initialState);
        
        // ソケットとゲームの関連付け
        if (!gameToSockets.has(gameId)) {
          gameToSockets.set(gameId, new Set());
        }
        gameToSockets.get(gameId)?.add(socket.id);
        socketToGame.set(socket.id, gameId);
        
        // ゲーム参加の通知
        socket.join(gameId);
        socket.emit('joinGame', { gameId, playerId, playerType: 'black' });
        socket.emit('gameState', initialState);
        
        console.log(`Game created: ${gameId}, Player: ${playerId} (black)`);
      });
      
      // ゲーム参加
      socket.on('joinGame', ({ gameId, asSpectator }) => {
        const playerId = socket.id;
        
        // ゲームが存在するか確認
        if (!games.has(gameId)) {
          socket.emit('gameNotFound');
          return;
        }
        
        const gameState = games.get(gameId)!;
        let playerType: PlayerType | 'spectator' = 'spectator';
        
        // 観戦者として参加する場合
        if (asSpectator) {
          gameState.spectators.push(playerId);
          playerType = 'spectator';
        }
        // プレイヤーとして参加する場合
        else {
          // 2人のプレイヤーが既に存在する場合は満員
          if (gameState.players.black && gameState.players.white) {
            socket.emit('gameFull');
            return;
          }
          
          // 黒がいない場合は黒として参加
          if (!gameState.players.black) {
            gameState.players.black = playerId;
            playerType = 'black';
          }
          // 白がいない場合は白として参加
          else if (!gameState.players.white) {
            gameState.players.white = playerId;
            playerType = 'white';
            gameState.isWaiting = false;
          }
        }
        
        // ソケットとゲームの関連付け
        if (!gameToSockets.has(gameId)) {
          gameToSockets.set(gameId, new Set());
        }
        gameToSockets.get(gameId)?.add(socket.id);
        socketToGame.set(socket.id, gameId);
        
        // ゲーム参加の通知
        socket.join(gameId);
        socket.emit('joinGame', { gameId, playerId, playerType });
        
        // 全員にゲーム状態を送信
        io?.to(gameId).emit('gameState', gameState);
        
        console.log(`Player ${playerId} joined game ${gameId} as ${playerType}`);
      });
      
      // 駒の配置
      socket.on('placeDisc', ({ gameId, playerId, move }) => {
        if (!games.has(gameId)) return;
        
        const gameState = games.get(gameId)!;
        
        // ゲーム終了していたり、待機中なら処理しない
        if (gameState.isGameOver || gameState.isWaiting) return;
        
        // 現在のプレイヤーの検証
        const playerType = gameState.players.black === playerId ? 'black' : 'white';
        if (playerType !== gameState.currentPlayer) return;
        
        // 駒を配置
        const newBoard = placeDisc(gameState.board, move, playerType);
        if (newBoard === gameState.board) return; // 無効な手の場合
        
        gameState.board = newBoard;
        gameState.lastMove = { ...move, player: playerType };
        
        // 自動回転モードの場合、駒を置いた位置を含むブロックを時計回りに回転
        if (gameState.settings.rotationMode === 'auto') {
          // 駒を置いた位置からブロックインデックスを特定
          const blockIndex = getBlockIndexFromPosition(move.row, move.col);
          
          // 回転回数の制限をチェック
          if (gameState.blockRotations[blockIndex] < gameState.maxRotations) {
            gameState.board = rotateBlock(gameState.board, blockIndex, 'clockwise');
            gameState.blockRotations[blockIndex]++;
            gameState.lastRotation = {
              blockIndex,
              direction: 'clockwise'
            };
          }
        }
        
        // 勝敗の確認
        const winner = checkWinner(gameState.board);
        if (winner) {
          gameState.winner = winner;
          gameState.isGameOver = true;
        }
        
        // 次のプレイヤーに交代
        gameState.currentPlayer = gameState.currentPlayer === 'black' ? 'white' : 'black';
        
        // 全員にゲーム状態を送信
        io?.to(gameId).emit('gameState', gameState);
      });
      
      // ブロックの回転
      socket.on('rotateBlock', ({ gameId, playerId, rotation }) => {
        if (!games.has(gameId)) return;
        
        const gameState = games.get(gameId)!;
        
        // ゲーム終了していたり、待機中なら処理しない
        if (gameState.isGameOver || gameState.isWaiting) return;
        
        // 現在のプレイヤーの検証
        const playerType = gameState.players.black === playerId ? 'black' : 'white';
        if (playerType !== gameState.currentPlayer) return;
        
        // 手動回転モードでない場合は処理しない
        if (gameState.settings.rotationMode !== 'manual') return;
        
        // 回転回数の制限をチェック
        if (gameState.blockRotations[rotation.blockIndex as keyof typeof gameState.blockRotations] >= gameState.maxRotations) return;
        
        // ブロックを回転
        gameState.board = rotateBlock(gameState.board, rotation.blockIndex, rotation.direction);
        gameState.blockRotations[rotation.blockIndex as keyof typeof gameState.blockRotations]++;
        gameState.lastRotation = rotation;
        
        // 勝敗の確認
        const winner = checkWinner(gameState.board);
        if (winner) {
          gameState.winner = winner;
          gameState.isGameOver = true;
        }
        
        // 次のプレイヤーに交代
        gameState.currentPlayer = gameState.currentPlayer === 'black' ? 'white' : 'black';
        
        // 全員にゲーム状態を送信
        io?.to(gameId).emit('gameState', gameState);
      });
      
      // ゲームリセット
      socket.on('resetGame', ({ gameId, playerId }) => {
        if (!games.has(gameId)) return;
        
        const gameState = games.get(gameId)!;
        
        // 黒または白のプレイヤーのみリセット可能
        if (gameState.players.black !== playerId && gameState.players.white !== playerId) return;
        
        // ゲーム状態をリセット
        gameState.board = initializeBoard();
        gameState.currentPlayer = 'black';
        gameState.winner = null;
        gameState.blockRotations = { 0: 0, 1: 0, 2: 0, 3: 0 };
        gameState.lastMove = null;
        gameState.lastRotation = null;
        gameState.isGameOver = false;
        
        // 全員にゲーム状態を送信
        io?.to(gameId).emit('gameState', gameState);
      });
      
      // ゲーム退出
      socket.on('leaveGame', ({ gameId, playerId }) => {
        if (!games.has(gameId)) return;
        
        handlePlayerDisconnect(socket.id, gameId);
      });
      
      // 切断時の処理
      socket.on('disconnect', () => {
        const gameId = socketToGame.get(socket.id);
        if (gameId) {
          handlePlayerDisconnect(socket.id, gameId);
        }
        
        console.log('Client disconnected:', socket.id);
      });
    });

    // サーバーをポート3001で起動
    httpServer.listen(3001, () => {
      console.log('Socket.io server started on port 3001');
    });

    // @ts-ignore
    global.server.io = io;
    // @ts-ignore
    global.server.initialized = true;
  }
  
  // @ts-ignore
  return global.server.io;
}

// プレイヤーの切断処理
function handlePlayerDisconnect(socketId: string, gameId: string) {
  if (!games.has(gameId)) return;
  
  const gameState = games.get(gameId)!;
  const gameSocketsSet = gameToSockets.get(gameId);
  
  // ソケットとゲームの関連付けを解除
  if (gameSocketsSet) {
    gameSocketsSet.delete(socketId);
    if (gameSocketsSet.size === 0) {
      gameToSockets.delete(gameId);
      games.delete(gameId);
    }
  }
  socketToGame.delete(socketId);
  
  // プレイヤーの場合、ゲームから削除
  if (gameState.players.black === socketId) {
    gameState.players.black = '';
    gameState.isWaiting = true;
  } else if (gameState.players.white === socketId) {
    gameState.players.white = '';
    gameState.isWaiting = true;
  } else {
    // 観戦者の場合
    gameState.spectators = gameState.spectators.filter(id => id !== socketId);
  }
  
  // 全員にゲーム状態を送信
  ensureIOServer()?.to(gameId).emit('gameState', gameState);
}

// API Routeのハンドラ
export async function GET(req: NextRequest) {
  if (!io) {
    // Socket.ioサーバーを初期化
    const res: any = { socket: { server: { io: null } } };
    res.socket.server.io = new ServerIO(res.socket.server as NetServer, {
      path: '/api/socketio',
      addTrailingSlash: false,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });
    
    io = res.socket.server.io;
    
    // Socket.ioイベントハンドラを設定
    io?.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // 切断イベント
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
      
      // ゲーム作成イベント
      socket.on('createGame', (callback) => {
        const gameId = generateGameId();
        socket.join(gameId);
        console.log(`Game created: ${gameId}`);
        
        if (typeof callback === 'function') {
          callback(gameId);
        }
      });
      
      // ゲーム参加イベント
      socket.on('joinGame', ({ gameId, playerId, playerType }) => {
        // ゲームルームが存在するか確認
        const room = io?.sockets.adapter.rooms.get(gameId);
        
        if (!room) {
          socket.emit('gameNotFound');
          return;
        }
        
        socket.join(gameId);
        console.log(`Player ${playerId} joined game ${gameId} as ${playerType}`);
        
        // 参加確認イベントを送信
        socket.emit('joinGame', { gameId, playerId, playerType });
        
        // 他のプレイヤーに通知
        socket.to(gameId).emit('playerJoin', { playerId, playerType });
      });
      
      // 駒配置イベント
      socket.on('placeDisc', ({ gameId, playerId, move }) => {
        console.log(`Player ${playerId} placed disc at ${move.row},${move.col} in game ${gameId}`);
        
        // 他のプレイヤーに通知
        socket.to(gameId).emit('discPlaced', { playerId, move });
      });
      
      // ブロック回転イベント
      socket.on('rotateBlock', ({ gameId, playerId, rotation }) => {
        console.log(`Player ${playerId} rotated block ${rotation.blockIndex} ${rotation.direction} in game ${gameId}`);
        
        // 他のプレイヤーに通知
        socket.to(gameId).emit('blockRotated', { playerId, rotation });
      });
      
      // ゲームリセットイベント
      socket.on('resetGame', ({ gameId, playerId }) => {
        console.log(`Player ${playerId} reset game ${gameId}`);
        
        // 他のプレイヤーに通知
        socket.to(gameId).emit('gameReset', { playerId });
      });
      
      // ゲーム退出イベント
      socket.on('leaveGame', ({ gameId, playerId }) => {
        socket.leave(gameId);
        console.log(`Player ${playerId} left game ${gameId}`);
        
        // 他のプレイヤーに通知
        socket.to(gameId).emit('playerLeft', { playerId });
      });
    });
  }
  
  ensureIOServer();
  return new Response('Socket.io Server is running', { status: 200 });
}

// ゲームIDを生成する関数
function generateGameId() {
  return Math.random().toString(36).substring(2, 8);
} 