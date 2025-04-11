'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GameBoard } from './game-board';
import { GameSettings } from './game-settings';
import { GameStatus } from './game-status';
import { OnlineControls } from './online-controls';
import { useGameStore } from '@/lib/game/store';
import { SocketClient } from '@/lib/online';
import { OnlineGameState, PlayerType, Rotation } from '@/types';
import { resumeAudioContext } from '@/lib/audio';

export function GameContainer() {
  const router = useRouter();
  const { 
    board, 
    currentPlayer, 
    winner, 
    isGameOver,
    blockRotations,
    maxRotations,
    settings,
    lastMove,
    lastRotation,
    placeDisc, 
    resetGame,
    updateSettings,
    skipTurn,
    playAITurn
  } = useGameStore();
  
  // オンラインモード用のソケットクライアント
  const [socketClient, setSocketClient] = useState<SocketClient | null>(null);
  
  // オンラインゲームの状態
  const [onlineState, setOnlineState] = useState<{
    gameId: string | null;
    playerId: string | null;
    playerType: PlayerType | 'spectator' | null;
    isWaiting: boolean;
  }>({
    gameId: null,
    playerId: null,
    playerType: null,
    isWaiting: false
  });
  
  // 通知メッセージ
  const [notification, setNotification] = useState<string | null>(null);
  
  // 接続エラーの状態
  const [connectionError, setConnectionError] = useState<boolean>(false);
  
  // 通知の自動クリア
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [notification]);
  
  // オンラインモードの場合、ソケットクライアントを初期化
  useEffect(() => {
    if (settings.gameMode === 'online' && !socketClient) {
      const events = {
        onConnect: () => {
          setNotification('サーバーに接続しました');
          setConnectionError(false);
          resumeAudioContext();
        },
        onDisconnect: () => {
          setNotification('サーバーから切断されました');
          setConnectionError(true);
          setOnlineState({
            gameId: null,
            playerId: null,
            playerType: null,
            isWaiting: false
          });
        },
        onError: (error: any) => {
          console.error('Socket error:', error);
          setConnectionError(true);
          setNotification(`接続エラー: ${typeof error === 'string' ? error : 'サーバーに接続できません。'}`);
        },
        onGameState: (state: OnlineGameState) => {
          // オンラインゲームの状態をローカルゲーム状態に反映
          updateSettings({
            gameMode: 'online',
            soundEnabled: settings.soundEnabled,
            rotationMode: 'manual'
          });
          
          // ゲームボードの状態を更新（直接storeのステートを更新）
          useGameStore.setState({
            board: state.board,
            currentPlayer: state.currentPlayer,
            winner: state.winner,
            blockRotations: state.blockRotations,
            isGameOver: state.isGameOver,
            lastMove: state.lastMove,
            lastRotation: state.lastRotation
          });
          
          // 待機状態を更新
          setOnlineState(prev => ({
            ...prev,
            isWaiting: state.isWaiting
          }));
          
          // 勝敗が決まった場合に通知
          if (state.winner && !winner) {
            if (state.winner === 'draw') {
              setNotification('引き分けです！');
            } else {
              setNotification(`${state.winner === 'black' ? '黒' : '白'}の勝利です！`);
            }
          }
        },
        onJoinGame: (gameId: string, playerId: string, playerType: PlayerType | 'spectator') => {
          setOnlineState({
            gameId,
            playerId,
            playerType,
            isWaiting: playerType === 'black' // 黒の場合は白のプレイヤーを待つ
          });
          
          if (playerType === 'spectator') {
            setNotification(`ゲーム ${gameId} を観戦中です`);
          } else {
            setNotification(`ゲーム ${gameId} に参加しました (${playerType === 'black' ? '黒' : '白'})`);
          }
        },
        onGameNotFound: () => {
          setNotification('指定されたゲームが見つかりませんでした');
        },
        onGameFull: () => {
          setNotification('ゲームが満員です');
        }
      };
      
      setSocketClient(new SocketClient(events));
    }
    
    // オンラインモードでなくなった場合、ソケットクライアントを切断
    if (settings.gameMode !== 'online' && socketClient) {
      socketClient.disconnect();
      setSocketClient(null);
      setConnectionError(false);
      setOnlineState({
        gameId: null,
        playerId: null,
        playerType: null,
        isWaiting: false
      });
    }
  }, [settings.gameMode, socketClient, winner, settings]);
  
  // 駒の配置ハンドラ
  const handlePlaceDisc = (move: { row: number; col: number }) => {
    // オンラインモードの場合はソケット経由で駒を配置
    if (settings.gameMode === 'online' && socketClient) {
      // 観戦者またはゲーム待機中、自分の手番でない場合は何もしない
      if (
        onlineState.playerType === 'spectator' || 
        onlineState.isWaiting || 
        (onlineState.playerType !== currentPlayer)
      ) {
        return;
      }
      
      socketClient.placeDisc(move);
      return;
    }
    
    // ローカルゲームの場合は直接駒を配置
    placeDisc(move);
  };
  
  // 設定更新ハンドラ
  const handleUpdateSettings = (newSettings: Partial<typeof settings>) => {
    // ゲーム状態変更後の設定変更時に効果音を有効にした場合、AudioContextを再開
    if (newSettings.soundEnabled && !settings.soundEnabled) {
      resumeAudioContext();
    }
    
    updateSettings(newSettings);
  };
  
  // ゲームリセットハンドラ
  const handleResetGame = () => {
    // オンラインモードの場合はソケット経由でリセット
    if (settings.gameMode === 'online' && socketClient) {
      socketClient.resetGame();
      return;
    }
    
    // ローカルゲームの場合は直接リセット
    resetGame();
  };

  // オンライン対戦を作成
  const handleCreateOnlineGame = useCallback(() => {
    setConnectionError(false);
    
    // ソケットクライアントを初期化
    const events = {
      onConnect: () => {
        // 接続成功後、ゲームを作成
        setConnectionError(false);
        socketClient?.createGame();
      },
      onDisconnect: () => {
        setConnectionError(true);
        setNotification('サーバーから切断されました。再接続中...');
      },
      onError: (error: any) => {
        console.error('Socket error:', error);
        setConnectionError(true);
        setNotification(`接続エラー: ${typeof error === 'string' ? error : 'サーバーに接続できません。'}`);
      },
      onGameState: (state: OnlineGameState) => {},
      onJoinGame: (gameId: string, playerId: string, playerType: PlayerType | 'spectator') => {
        // ゲーム作成後、ゲームページに遷移
        router.push(`/game/${gameId}`);
      },
      onGameNotFound: () => {
        setNotification('ゲームの作成に失敗しました。再度お試しください。');
      },
      onGameFull: () => {}
    };
    
    const newSocketClient = new SocketClient(events);
    setSocketClient(newSocketClient);
    newSocketClient.connect();
    setNotification('オンラインゲームを作成中...');
  }, [router, socketClient]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-extrabold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">回転コネクトフォー</h1>
        
        {notification && (
          <div className={`w-full max-w-md mx-auto mb-6 p-3 rounded-lg border shadow-lg backdrop-blur-sm animate-pulse ${
            connectionError ? 'bg-red-900/60 text-red-100 border-red-700' : 'bg-blue-900/60 text-blue-100 border-blue-700'
          }`}>
            {notification}
          </div>
        )}
        
        {/* オンライン対戦作成ボタン */}
        <div className="max-w-md mx-auto mb-8 text-center">
          <button
            className="py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg shadow-lg hover:from-blue-500 hover:to-purple-500 transition-all duration-300"
            onClick={handleCreateOnlineGame}
            disabled={connectionError}
          >
            オンライン対戦を作成
          </button>
          <p className="mt-2 text-sm text-gray-400">友達と対戦するためのリンクが生成されます</p>
          
          {connectionError && (
            <div className="mt-4 p-3 bg-red-900/40 text-red-100 rounded-lg border border-red-800">
              <p className="font-bold">接続に問題があります</p>
              <p className="text-sm mt-1">ブラウザの更新を試みるか、しばらく経ってから再度お試しください。</p>
            </div>
          )}
        </div>
        
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-gray-800/70 rounded-2xl p-6 shadow-xl border border-gray-700">
              <GameStatus 
                currentPlayer={currentPlayer}
                winner={winner}
                isGameOver={isGameOver}
                gameMode={settings.gameMode}
                isWaiting={settings.gameMode === 'online' && onlineState.isWaiting}
              />
              
              <div className="my-6 flex justify-center">
                <GameBoard
                  board={board}
                  currentPlayer={currentPlayer}
                  isGameOver={isGameOver}
                  blockRotations={blockRotations}
                  maxRotations={maxRotations}
                  onPlaceDisc={handlePlaceDisc}
                  lastMove={lastMove}
                  lastRotation={lastRotation}
                />
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <div className="bg-gray-800/70 rounded-2xl p-6 shadow-xl border border-gray-700 h-full">
              <h2 className="text-xl font-bold mb-4 text-blue-300">ゲーム設定</h2>
              <GameSettings
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onReset={handleResetGame}
                disabled={settings.gameMode === 'online' && (
                  onlineState.playerType === 'spectator' || 
                  (onlineState.playerType !== null && onlineState.playerType !== 'black')
                )}
              />
              
              {settings.gameMode === 'online' && (
                <div className="mt-6">
                  <h2 className="text-xl font-bold mb-4 text-blue-300">オンライン</h2>
                  <OnlineControls
                    client={socketClient}
                    onConnect={() => {}}
                    onDisconnect={() => {}}
                    onJoinGame={(gameId, playerId, playerType) => {}}
                    onGameState={(state) => {}}
                    onError={(message) => setNotification(message)}
                    disabled={isGameOver}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>© 2023 回転コネクトフォー</p>
        </footer>
      </div>
    </div>
  );
} 