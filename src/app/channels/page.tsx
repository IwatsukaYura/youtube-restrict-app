'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Channel } from '@/models/channel';

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  //useCallbackを使用している理由：依存配列が変更されない限り、関数の再作成を防ぐため
  const loadChannels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/channels');
      if (!res.ok) throw new Error('チャンネルの取得に失敗しました');

      const data: Channel[] = await res.json();
      setChannels(data);
      setSelected(
        new Set(
          data.filter((c) => c.isSelected).map((c) => c.youtubeChannelId),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初回レンダリングでチャンネルをロード
  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const syncChannels = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/channels/sync', { method: 'POST' });
      if (!res.ok) throw new Error('同期に失敗しました');
      await loadChannels();
    } catch (e) {
      setError(e instanceof Error ? e.message : '同期エラーが発生しました');
    } finally {
      setIsSyncing(false);
    }
  };

  const saveSelection = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected: Array.from(selected) }),
      });
      if (!res.ok) throw new Error('保存に失敗しました');
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存エラーが発生しました');
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = (channelId: string) => {
    //previous stateに基づいて次のstateを計算
    //関数型を利用するのは、selectedが最新の状態で更新されることを保証するため
    setSelected((prev) => {
      //新しいSetを作成して変更を加える（イミュタブルな更新）
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  };

  const filteredChannels = channels.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()),
  );

  //以下はUI表示ロジック
  let channelListContent;
  if (isLoading) {
    channelListContent = (
      <div className="py-12 text-center text-sm text-gray-400">
        読み込み中...
      </div>
    );
  } else if (filteredChannels.length === 0) {
    channelListContent = (
      <div className="py-12 text-center text-sm text-gray-400">
        {channels.length === 0
          ? 'チャンネルがありません。「チャンネルを同期」を押してください'
          : '該当するチャンネルがありません'}
      </div>
    );
  } else {
    channelListContent = filteredChannels.map((channel) => (
      <label
        key={channel.youtubeChannelId}
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
      >
        <input
          type="checkbox"
          checked={selected.has(channel.youtubeChannelId)}
          onChange={() => toggle(channel.youtubeChannelId)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        {channel.thumbnailUrl && (
          <Image
            src={channel.thumbnailUrl}
            alt={channel.title}
            width={32}
            height={32}
            className="rounded-full flex-shrink-0"
          />
        )}
        <span className="text-sm text-gray-900 truncate">{channel.title}</span>
      </label>
    ));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              ← 戻る
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">
              チャンネル設定
            </h1>
          </div>
          <button
            onClick={syncChannels}
            disabled={isSyncing}
            className="text-sm bg-white border border-gray-300 hover:border-gray-400 text-gray-700 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing ? '同期中...' : 'チャンネルを同期'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              {channels.length}件 / 選択中: {selected.size}件
            </p>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setSelected(
                    new Set(channels.map((c) => c.youtubeChannelId)),
                  )
                }
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                全選択
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                全解除
              </button>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-gray-100">
            <input
              type="search"
              placeholder="チャンネルを検索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>{channelListContent}</div>
        </div>

        <div className="mt-4">
          <button
            onClick={saveSelection}
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '保存中...' : '変更を保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
