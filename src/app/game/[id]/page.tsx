import { OnlineGameContainer } from '@/components/online-game-container';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'オンライン対戦 | 回転コネクトフォー',
  description: 'オンラインで友達と回転コネクトフォーでプレイしよう',
};

interface GamePageProps {
  params: {
    id: string;
  };
}

export default function GamePage({ params }: GamePageProps) {
  return (
    <main>
      <OnlineGameContainer gameId={params.id} />
    </main>
  );
} 