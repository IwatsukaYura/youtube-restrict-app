import type { Channel } from '@/models/channel';
import type { Video } from '@/models/video';

export type DailyPick = {
  id: string;
  userId: string;
  youtubeChannelId: string;
  youtubeVideoId: string;
  pickDate: string;
  pickReason: 'new' | 'random';
  createdAt: string;
};

export type DailyPickWithDetails = DailyPick & {
  channel: Pick<Channel, 'title' | 'thumbnailUrl' | 'youtubeChannelId'>;
  video: Pick<
    Video,
    'title' | 'thumbnailUrl' | 'durationSeconds' | 'publishedAt' | 'youtubeVideoId'
  >;
};
