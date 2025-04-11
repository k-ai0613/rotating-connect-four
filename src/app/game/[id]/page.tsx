import { OnlineGameContainer } from '@/components/online-game-container';
import { Metadata } from 'next';

interface GamePageProps {
  params: {
    id: string;
  };
  searchParams?: Record<string, string | string[]>;
}

export async function generateMetadata({ params }: GamePageProps): Promise<Metadata> {
  return {
    title: `ゲーム ${params.id} | 回転コネクトフォー`,
  };
}

export default function GamePage({ params }: GamePageProps) {
  return (
    <main>
      <OnlineGameContainer gameId={params.id} />
    </main>
  );
} 