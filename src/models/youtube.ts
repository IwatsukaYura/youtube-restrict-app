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
  isShorts: boolean;
  publishedAt: string;
};
