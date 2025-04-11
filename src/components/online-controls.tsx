'use client';

import { useState, useEffect } from 'react';
import { SocketClient, SocketStatus } from '@/lib/online';
import { OnlineGameState } from '@/types';
import { resumeAudioContext } from '@/lib/audio';

interface OnlineControlsProps {
  client: SocketClient | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onJoinGame: (gameId: string, playerId: string, playerType: string) => void;
  onGameState: (gameState: OnlineGameState) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

export function OnlineControls({
  client,
  onConnect,
  onDisconnect,
  onJoinGame,
  onGameState,
  onError,
  disabled = false
}: OnlineControlsProps) {
  const [gameIdInput, setGameIdInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<SocketStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // クライアントのステータスを監視
  useEffect(() => {
    if (client) {
      setConnectionStatus(client.getStatus());
    }
  }, [client]);

  // 接続
  const handleConnect = () => {
    if (!client) return;
    
    // イベントハンドラを設定してから接続
    const events = {
      onConnect: () => {
        setConnectionStatus('connected');
        setError(null);
        onConnect();
        // サウンドのAudioContextを再開（ユーザージェスチャー後に実行する必要がある）
        resumeAudioContext();
      },
      onDisconnect: () => {
        setConnectionStatus('disconnected');
        onDisconnect();
      },
      onError: (err: any) => {
        setError(`エラーが発生しました: ${err.message || JSON.stringify(err)}`);
        onError(`エラーが発生しました: ${err.message || JSON.stringify(err)}`);
      },
      onGameState: (gameState: OnlineGameState) => {
        onGameState(gameState);
      },
      onJoinGame: (gameId: string, playerId: string, playerType: string) => {
        setError(null);
        onJoinGame(gameId, playerId, playerType);
      },
      onGameNotFound: () => {
        setError('指定されたゲームが見つかりませんでした');
        onError('指定されたゲームが見つかりませんでした');
      },
      onGameFull: () => {
        setError('ゲームが満員です');
        onError('ゲームが満員です');
      }
    };
    
    client.connect();
  };

  // 切断
  const handleDisconnect = () => {
    if (!client) return;
    client.disconnect();
    setConnectionStatus('disconnected');
  };

  // 新しいゲームを作成
  const handleCreateGame = () => {
    if (!client || connectionStatus !== 'connected') return;
    client.createGame();
  };

  // ゲームに参加
  const handleJoinGame = (asSpectator: boolean = false) => {
    if (!client || connectionStatus !== 'connected' || !gameIdInput.trim()) {
      setError('ゲームIDを入力してください');
      return;
    }

    client.joinGame(gameIdInput.trim(), asSpectator);
  };

  // ゲームから退出
  const handleLeaveGame = () => {
    if (!client || connectionStatus !== 'connected') return;
    client.leaveGame();
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-white shadow-md rounded-lg border border-gray-200">
      <h3 className="text-lg font-bold mb-3">オンラインプレイ</h3>

      {/* 接続状態の表示 */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`h-3 w-3 rounded-full mr-2 ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'connecting' ? 'bg-yellow-500' :
              'bg-red-500'
            }`} />
            <span>
              {connectionStatus === 'connected' ? '接続済み' :
              connectionStatus === 'connecting' ? '接続中...' :
              '未接続'}
            </span>
          </div>
          
          {connectionStatus === 'disconnected' ? (
            <button
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-500 transition-colors"
              onClick={handleConnect}
              disabled={disabled}
            >
              接続
            </button>
          ) : (
            <button
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
              onClick={handleDisconnect}
              disabled={disabled}
            >
              切断
            </button>
          )}
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* 接続中であれば操作パネルを表示 */}
      {connectionStatus === 'connected' && (
        <>
          {/* ゲーム作成ボタン */}
          <div className="mb-4">
            <button
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
              onClick={handleCreateGame}
              disabled={disabled}
            >
              新しいゲームを作成
            </button>
          </div>

          {/* ゲーム参加フォーム */}
          <div className="mb-4">
            <div className="mb-2">
              <input
                type="text"
                value={gameIdInput}
                onChange={(e) => setGameIdInput(e.target.value)}
                placeholder="ゲームID"
                className="w-full p-2 border border-gray-300 rounded"
                disabled={disabled}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
                onClick={() => handleJoinGame(false)}
                disabled={disabled || !gameIdInput}
              >
                ゲームに参加
              </button>
              <button
                className="py-2 bg-purple-600 text-white rounded hover:bg-purple-500 transition-colors"
                onClick={() => handleJoinGame(true)}
                disabled={disabled || !gameIdInput}
              >
                観戦
              </button>
            </div>
          </div>

          {/* ゲーム退出ボタン */}
          <div>
            <button
              className="w-full py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
              onClick={handleLeaveGame}
              disabled={disabled}
            >
              ゲームから退出
            </button>
          </div>
        </>
      )}
    </div>
  );
} 