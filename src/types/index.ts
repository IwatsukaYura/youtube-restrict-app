export type Channel = {
  id: string;
  userId: string;
  youtubeChannelId: string;
  title: string;
  thumbnailUrl: string | null;
  uploadsPlaylistId: string | null;
  isSelected: boolean;
  syncedAt: string | null;
  createdAt: string;
};

export type Video = {
  id: string;
  youtubeVideoId: string;
  youtubeChannelId: string;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  publishedAt: string;
  cachedAt: string;
};

export type DailyPick = {
  id: string;
  userId: string;
  youtubeChannelId: string;
  youtubeVideoId: string;
  pickDate: string;
  pickReason: "new" | "random";
  createdAt: string;
};

export type DailyPickWithDetails = DailyPick & {
  channel: Pick<Channel, "title" | "thumbnailUrl" | "youtubeChannelId">;
  video: Pick<Video, "title" | "thumbnailUrl" | "durationSeconds" | "publishedAt" | "youtubeVideoId">;
};

export type YoutubeSubscription = {
  channelId: string;
  title: string;
  thumbnailUrl: string;
};

export type YoutubeVideoMeta = {
  videoId: string;
  channelId: string;
  title: string;
  thumbnailUrl: string;
  durationSeconds: number;
  publishedAt: string;
};
