'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GameBoard } from './game-board';
import { GameStatus } from './game-status';
import { useGameStore } from '@/lib/game/store';
import { SocketClient } from '@/lib/online';
import { OnlineGameState, PlayerType, Rotation } from '@/types';
import { resumeAudioContext } from '@/lib/audio';
import { copyToClipboard } from '@/lib/utils';

interface OnlineGameContainerProps {
  gameId: string;
}

export function OnlineGameContainer({ gameId }: OnlineGameContainerProps) {
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
    skipTurn
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
  
  // コンポーネントがマウントされたらゲームモードをオンラインに設定する
  useEffect(() => {
    updateSettings({
      gameMode: 'online',
      rotationMode: 'manual'
    });
  }, [updateSettings]);
  
  // オンラインモードの場合、ソケットクライアントを初期化
  useEffect(() => {
    if (!socketClient) {
      const events = {
        onConnect: () => {
          setNotification('サーバーに接続しました');
          setConnectionError(false);
          resumeAudioContext();
          
          // 接続したらゲームIDでゲームに参加する
          if (gameId) {
            setTimeout(() => {
              socketClient?.joinGame(gameId);
            }, 500);
          }
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
          setConnectionError(true);
          // 5秒後にトップページに戻る
          setTimeout(() => {
            router.push('/');
          }, 5000);
        },
        onGameFull: () => {
          setNotification('ゲームが満員です。観戦モードで参加します。');
          // 既存のゲームが満員の場合は観戦モードで再接続
          setTimeout(() => {
            socketClient?.joinGame(gameId, true);
          }, 1000);
        }
      };
      
      const newSocketClient = new SocketClient(events);
      setSocketClient(newSocketClient);
      newSocketClient.connect();
    }
    
    return () => {
      // コンポーネントがアンマウントされたらソケットを切断
      if (socketClient) {
        socketClient.disconnect();
      }
    };
  }, [socketClient, gameId, settings.soundEnabled, winner, router, updateSettings]);
  
  // 駒の配置ハンドラ
  const handlePlaceDisc = useCallback((move: { row: number; col: number }) => {
    // 観戦者またはゲーム待機中、自分の手番でない場合は何もしない
    if (
      onlineState.playerType === 'spectator' || 
      onlineState.isWaiting || 
      (onlineState.playerType !== currentPlayer) ||
      connectionError
    ) {
      return;
    }
    
    // ソケット経由で駒を配置
    socketClient?.placeDisc(move);
  }, [socketClient, onlineState, currentPlayer, connectionError]);
  
  // ブロックの回転ハンドラ
  const handleRotateBlock = useCallback((rotation: Rotation) => {
    // 観戦者またはゲーム待機中、自分の手番でない場合は何もしない
    if (
      onlineState.playerType === 'spectator' || 
      onlineState.isWaiting || 
      (onlineState.playerType !== currentPlayer) ||
      connectionError
    ) {
      return;
    }
    
    // ソケット経由でブロックを回転
    socketClient?.rotateBlock(rotation);
  }, [socketClient, onlineState, currentPlayer, connectionError]);
  
  // ゲームIDをコピーする
  const handleCopyGameId = useCallback(() => {
    if (onlineState.gameId) {
      // ゲームURLをクリップボードにコピー
      const gameUrl = `${window.location.origin}/game/${onlineState.gameId}`;
      copyToClipboard(gameUrl);
      setNotification('ゲームURLをコピーしました！友達に共有してください');
    }
  }, [onlineState.gameId]);
  
  // ゲームをリセットする
  const handleResetGame = useCallback(() => {
    if (connectionError) {
      setNotification('接続エラーのため、リセットできません');
      return;
    }
    socketClient?.resetGame();
  }, [socketClient, connectionError]);
  
  // ホームに戻る
  const handleBackToHome = useCallback(() => {
    router.push('/');
  }, [router]);
  
  // サーバーに再接続する
  const handleReconnect = useCallback(() => {
    if (socketClient) {
      socketClient.disconnect();
      setSocketClient(null);
      setNotification('再接続中...');
      
      // 少し遅延を入れてから再接続
      setTimeout(() => {
        const events = {
          onConnect: () => {
            setNotification('サーバーに接続しました');
            setConnectionError(false);
            resumeAudioContext();
            
            // 接続したらゲームIDでゲームに参加する
            if (gameId) {
              setTimeout(() => {
                socketClient?.joinGame(gameId);
              }, 500);
            }
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
            // 上記と同じ処理
            updateSettings({
              gameMode: 'online',
              soundEnabled: settings.soundEnabled,
              rotationMode: 'manual'
            });
            
            useGameStore.setState({
              board: state.board,
              currentPlayer: state.currentPlayer,
              winner: state.winner,
              blockRotations: state.blockRotations,
              isGameOver: state.isGameOver,
              lastMove: state.lastMove,
              lastRotation: state.lastRotation
            });
            
            setOnlineState(prev => ({
              ...prev,
              isWaiting: state.isWaiting
            }));
          },
          onJoinGame: (gameId: string, playerId: string, playerType: PlayerType | 'spectator') => {
            setOnlineState({
              gameId,
              playerId,
              playerType,
              isWaiting: playerType === 'black'
            });
            
            if (playerType === 'spectator') {
              setNotification(`ゲーム ${gameId} を観戦中です`);
            } else {
              setNotification(`ゲーム ${gameId} に参加しました (${playerType === 'black' ? '黒' : '白'})`);
            }
          },
          onGameNotFound: () => {
            setNotification('指定されたゲームが見つかりませんでした');
            setConnectionError(true);
            setTimeout(() => {
              router.push('/');
            }, 5000);
          },
          onGameFull: () => {
            setNotification('ゲームが満員です。観戦モードで参加します。');
            setTimeout(() => {
              socketClient?.joinGame(gameId, true);
            }, 1000);
          }
        };
        
        const newSocketClient = new SocketClient(events);
        setSocketClient(newSocketClient);
        newSocketClient.connect();
      }, 1000);
    }
  }, [socketClient, gameId, settings.soundEnabled, router, updateSettings]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-extrabold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
          回転コネクトフォー オンライン
        </h1>
        
        {notification && (
          <div className={`w-full max-w-md mx-auto mb-6 p-3 rounded-lg border shadow-lg backdrop-blur-sm animate-pulse ${
            connectionError ? 'bg-red-900/60 text-red-100 border-red-700' : 'bg-blue-900/60 text-blue-100 border-blue-700'
          }`}>
            {notification}
          </div>
        )}
        
        {/* オンラインゲーム情報 */}
        <div className="max-w-md mx-auto mb-8 p-4 bg-gray-800/70 rounded-xl border border-gray-700 shadow-lg">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2 text-blue-300">ゲーム情報</h2>
            <p className="text-gray-300 mb-2">
              ゲームID: <span className="font-mono text-blue-200">{onlineState.gameId || 'N/A'}</span>
            </p>
            <p className="text-gray-300 mb-4">
              あなたの役割: {
                onlineState.playerType === 'black' ? '黒（先手）' :
                onlineState.playerType === 'white' ? '白（後手）' :
                onlineState.playerType === 'spectator' ? '観戦者' : '接続中...'
              }
            </p>
            
            <div className="flex justify-center space-x-3">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCopyGameId}
                disabled={!onlineState.gameId || connectionError}
              >
                URLをコピー
              </button>
              <button
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
                onClick={handleBackToHome}
              >
                ホームに戻る
              </button>
            </div>
            
            {connectionError && (
              <button
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors w-full"
                onClick={handleReconnect}
              >
                サーバーに再接続
              </button>
            )}
          </div>
        </div>
        
        <div className="max-w-3xl mx-auto">
          <div className="bg-gray-800/70 rounded-2xl p-6 shadow-xl border border-gray-700">
            <GameStatus 
              currentPlayer={currentPlayer}
              winner={winner}
              isGameOver={isGameOver}
              gameMode="online"
              isWaiting={onlineState.isWaiting}
              onReset={handleResetGame}
            />
            
            <div className="my-6 flex justify-center">
              <GameBoard
                board={board}
                currentPlayer={currentPlayer}
                isGameOver={isGameOver}
                blockRotations={blockRotations}
                maxRotations={maxRotations}
                onPlaceDisc={handlePlaceDisc}
                onRotateBlock={handleRotateBlock}
                lastMove={lastMove}
                lastRotation={lastRotation}
                isSpectator={onlineState.playerType === 'spectator' || connectionError}
                isWrongTurn={onlineState.playerType !== currentPlayer && onlineState.playerType !== 'spectator'}
              />
            </div>
            
            {onlineState.isWaiting && (
              <div className="mt-6 text-center p-4 bg-blue-900/30 rounded-lg border border-blue-800">
                <p className="text-blue-200 animate-pulse">対戦相手の参加を待っています...</p>
                <p className="text-gray-400 mt-2 text-sm">上部の「URLをコピー」ボタンで友達に招待リンクを共有してください</p>
              </div>
            )}
            
            {connectionError && (
              <div className="mt-6 text-center p-4 bg-red-900/30 rounded-lg border border-red-800">
                <p className="text-red-200">サーバーとの接続に問題があります</p>
                <p className="text-gray-400 mt-2 text-sm">「サーバーに再接続」ボタンをクリックして再接続を試みてください</p>
              </div>
            )}
          </div>
        </div>
        
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>© 2023 回転コネクトフォー</p>
        </footer>
      </div>
    </div>
  );
} 