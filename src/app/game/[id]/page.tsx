import { OnlineGameContainer } from '@/components/online-game-container';
import { Metadata } from 'next';

// 基本的な型定義
type Params = {
  id: string;
};

// メタデータ生成
export async function generateMetadata({ 
  params 
}: { 
  params: Params 
}): Promise<Metadata> {
  return {
    title: `ゲーム ${params.id} | 回転コネクトフォー`,
  };
}

// 型を明示的に指定
export default async function GamePage({ 
  params 
}: { 
  params: Params 
}) {
  return (
    <main>
      <OnlineGameContainer gameId={params.id} />
    </main>
  );
} 