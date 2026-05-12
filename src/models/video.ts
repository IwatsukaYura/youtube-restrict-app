export type Video = {
  id: string;
  youtubeVideoId: string;
  youtubeChannelId: string;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  isShorts: boolean;
  publishedAt: string;
  cachedAt: string;
};
