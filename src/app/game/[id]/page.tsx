import { OnlineGameContainer } from '@/components/online-game-container';
import { Metadata } from 'next';

// Next.js 15の型定義に合わせる
type Params = {
  id: string;
};

type Props = {
  params: Params;
  searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `ゲーム ${params.id} | 回転コネクトフォー`,
  };
}

// export defaultの前にasyncを追加
export default async function GamePage({ params }: Props) {
  return (
    <main>
      <OnlineGameContainer gameId={params.id} />
    </main>
  );
} 