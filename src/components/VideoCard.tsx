"use client";

import Image from "next/image";
import { useState } from "react";
import type { DailyPickWithDetails } from "@/types";
import VideoModal from "@/components/VideoModal";

type Props = {
  pick: DailyPickWithDetails;
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function VideoCard({ pick }: Props) {
  const [showModal, setShowModal] = useState(false);
  const { channel, video } = pick;

  return (
    <>
      <article className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
        <button
          className="relative w-full aspect-video bg-gray-100 block"
          onClick={() => setShowModal(true)}
          aria-label={`${video.title} を再生`}
        >
          {video.thumbnailUrl ? (
            <Image
              src={video.thumbnailUrl}
              alt={video.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
            <div className="bg-white/90 rounded-full p-3">
              <svg className="w-8 h-8 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </button>

        <div className="p-4 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-2">
            {channel.thumbnailUrl && (
              <Image
                src={channel.thumbnailUrl}
                alt={channel.title}
                width={24}
                height={24}
                className="rounded-full"
              />
            )}
            <span className="text-sm font-medium text-gray-600 truncate">{channel.title}</span>
          </div>

          <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2 text-sm leading-snug">
            {video.title}
          </h3>

          <div className="flex items-center justify-between text-xs text-gray-400 mt-auto">
            <span>{formatDate(video.publishedAt)}</span>
            <span>{formatDuration(video.durationSeconds)}</span>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="mt-3 w-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            再生
          </button>
        </div>
      </article>

      {showModal && (
        <VideoModal
          videoId={video.youtubeVideoId}
          title={video.title}
          channelName={channel.title}
          publishedAt={video.publishedAt}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
