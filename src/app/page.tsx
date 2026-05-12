'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import VideoCard from '@/components/VideoCard';
import Header from '@/components/Header';
import type { DailyPickWithDetails } from '@/models/pick';

function ExtractTodayDate(): string {
  return new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

//ローディング中に表示させる用の擬似カード
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
      <div className="w-full aspect-video bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-200" />
          <div className="h-3 bg-gray-200 rounded w-24" />
        </div>
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-8 bg-gray-200 rounded-lg w-full mt-1" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const [picks, setPicks] = useState<DailyPickWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  //動画の取得
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/picks');
        if (!res.ok) throw new Error('動画の取得に失敗しました');
        const data: DailyPickWithDetails[] = await res.json();
        setPicks(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  let videoCardsContent;
  if (isLoading) {
    videoCardsContent = (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  } else if (picks.length === 0) {
    videoCardsContent = (
      <div className="text-center py-20 text-gray-500">
        <p className="text-lg font-medium mb-2">動画がありません</p>
        <p className="text-sm mb-6">
          チャンネルを選択すると今日の動画が表示されます
        </p>
        <Link
          href="/channels"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-5 rounded-lg transition-colors"
        >
          チャンネルを設定する
        </Link>
      </div>
    );
  } else {
    videoCardsContent = (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {picks.map((pick) => (
          <VideoCard key={pick.youtubeChannelId} pick={pick} />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">今日の動画</h2>
          <p className="text-sm text-gray-500 mt-1">{ExtractTodayDate()}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-6">
            {error}
            <button
              onClick={() => window.location.reload()}
              className="ml-3 underline hover:no-underline"
            >
              再試行
            </button>
          </div>
        )}

        {videoCardsContent}
      </main>
    </div>
  );
}
