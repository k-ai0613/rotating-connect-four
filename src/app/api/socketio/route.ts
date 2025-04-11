import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { NextRequest } from 'next/server';

// Socketサーバーのインスタンスを保持するグローバル変数
let socketIOServer: SocketIOServer | null = null;

export async function GET(req: NextRequest) {
  if (socketIOServer) {
    // 既にサーバーが起動している場合は、そのままレスポンスを返す
    return new Response('Socket.IO server already running', { status: 200 });
  }

  try {
    // Socket.IOサーバーを初期化
    const path = '/api/socketio';
    console.log('Initializing Socket.IO server with path:', path);

    const res: any = {};
    res.socket = { server: global };

    const httpServer: any = res.socket.server;
    
    socketIOServer = new SocketIOServer(httpServer, {
      path: path,
      addTrailingSlash: false,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    // Socket.IOイベントハンドラ
    socketIOServer.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // ゲーム作成イベント
      socket.on('createGame', (callback) => {
        const gameId = Math.random().toString(36).substring(2, 8);
        socket.join(gameId);
        console.log(`Game created: ${gameId}`);
        
        if (typeof callback === 'function') {
          callback(gameId);
        } else {
          socket.emit('gameCreated', gameId);
        }
      });

      // ゲーム参加イベント
      socket.on('joinGame', ({ gameId, playerId, playerType }) => {
        const room = socketIOServer?.sockets.adapter.rooms.get(gameId);
        
        if (!room) {
          socket.emit('gameNotFound');
          return;
        }
        
        socket.join(gameId);
        console.log(`Player ${playerId} joined game ${gameId} as ${playerType}`);
        
        socket.emit('joinedGame', { gameId, playerId, playerType });
        socket.to(gameId).emit('playerJoined', { playerId, playerType });
      });

      // 切断イベント
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    // グローバルなサーバーインスタンスとして保存
    res.socket.server.io = socketIOServer;

    console.log('Socket.IO server initialized successfully');
    return new Response('Socket.IO server initialized', { status: 200 });
  } catch (error) {
    console.error('Failed to initialize Socket.IO server:', error);
    return new Response(`Failed to start Socket.IO server: ${(error as Error).message}`, { status: 500 });
  }
} 