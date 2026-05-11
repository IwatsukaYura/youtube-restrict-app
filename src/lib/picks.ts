import type { SupabaseClient } from '@supabase/supabase-js';
import type { DailyPickWithDetails, YoutubeVideoMeta } from '@/types';
import {
  fetchRecentVideoIds,
  fetchVideoMetas,
  fetchUploadsPlaylistId,
} from '@/lib/youtube';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

type SelectedChannel = {
  youtube_channel_id: string;
  title: string;
  thumbnail_url: string | null;
  uploads_playlist_id: string | null;
};

type CachedVideoMeta = {
  youtube_video_id: string;
  duration_seconds: number;
  is_shorts: boolean;
  published_at: string;
};

type VideoDetail = {
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  published_at: string;
};

function getTodayJst(): string {
  const now = new Date(Date.now() + JST_OFFSET_MS);
  return now.toISOString().slice(0, 10);
}

async function cacheVideos(
  db: SupabaseClient,
  metas: YoutubeVideoMeta[],
): Promise<void> {
  if (metas.length === 0) return;
  await db.from('videos').upsert(
    metas.map((m) => ({
      youtube_video_id: m.videoId,
      youtube_channel_id: m.channelId,
      title: m.title,
      thumbnail_url: m.thumbnailUrl,
      duration_seconds: m.durationSeconds,
      is_shorts: m.isShorts,
      published_at: m.publishedAt,
    })),
    { onConflict: 'youtube_video_id', ignoreDuplicates: true },
  );
}

async function decideVideoForChannel(
  db: SupabaseClient,
  channelId: string,
  uploadsPlaylistId: string,
  lastUsedDate: string,
  accessToken: string,
): Promise<{ videoId: string; reason: 'new' | 'random' } | null> {
  const recent = await fetchRecentVideoIds(uploadsPlaylistId, accessToken, 50);
  const allVideoIds = recent.map((r) => r.videoId);
  if (allVideoIds.length === 0) return null;

  const { data: cached } = await db
    .from('videos')
    .select('youtube_video_id, duration_seconds, is_shorts, published_at')
    .in('youtube_video_id', allVideoIds);

  const cachedMetas: CachedVideoMeta[] = cached ?? [];
  const cachedIds = new Set(cachedMetas.map((m) => m.youtube_video_id));
  const uncachedIds = allVideoIds.filter((id) => !cachedIds.has(id));

  if (uncachedIds.length > 0) {
    const fresh = await fetchVideoMetas(uncachedIds, accessToken);
    await cacheVideos(db, fresh);
    for (const m of fresh) {
      cachedMetas.push({
        youtube_video_id: m.videoId,
        duration_seconds: m.durationSeconds,
        is_shorts: m.isShorts,
        published_at: m.publishedAt,
      });
    }
  }

  const nonShorts = cachedMetas.filter((m) => !m.is_shorts);
  if (nonShorts.length === 0) return null;

  const newVideos = nonShorts
    .filter((m) => m.published_at > lastUsedDate)
    .sort((a, b) => b.published_at.localeCompare(a.published_at));

  if (newVideos.length > 0) {
    return { videoId: newVideos[0].youtube_video_id, reason: 'new' };
  }

  const idx = Math.floor(Math.random() * nonShorts.length);
  return { videoId: nonShorts[idx].youtube_video_id, reason: 'random' };
}

async function ensurePlaylistId(
  db: SupabaseClient,
  channel: SelectedChannel,
  accessToken: string,
): Promise<string | null> {
  if (channel.uploads_playlist_id) return channel.uploads_playlist_id;

  const playlistId = await fetchUploadsPlaylistId(
    channel.youtube_channel_id,
    accessToken,
  );
  if (playlistId) {
    await db
      .from('channels')
      .update({ uploads_playlist_id: playlistId })
      .eq('youtube_channel_id', channel.youtube_channel_id);
  }
  return playlistId;
}

function buildPicks(
  channels: SelectedChannel[],
  channelToVideoId: Map<string, string>,
  videoMap: Map<string, VideoDetail>,
  userId: string,
  today: string,
): DailyPickWithDetails[] {
  const result: DailyPickWithDetails[] = [];
  for (const ch of channels) {
    const videoId = channelToVideoId.get(ch.youtube_channel_id);
    if (!videoId) continue;
    const video = videoMap.get(videoId);
    if (!video) continue;

    result.push({
      id: '',
      userId,
      youtubeChannelId: ch.youtube_channel_id,
      youtubeVideoId: videoId,
      pickDate: today,
      pickReason: 'new',
      createdAt: new Date().toISOString(),
      channel: {
        youtubeChannelId: ch.youtube_channel_id,
        title: ch.title,
        thumbnailUrl: ch.thumbnail_url,
      },
      video: {
        youtubeVideoId: video.youtube_video_id,
        title: video.title,
        thumbnailUrl: video.thumbnail_url,
        durationSeconds: video.duration_seconds,
        publishedAt: video.published_at,
      },
    });
  }
  return result;
}

//user_sessionsテーブルからlast_used_dateを取得し、動画選定の基準日時とし、
//channelsテーブルからユーザが選択したチャンネルを取得し、
//該当チャンネルの
export async function generateDailyPicks(
  db: SupabaseClient,
  userId: string,
  accessToken: string,
): Promise<DailyPickWithDetails[]> {
  const todayDate = getTodayJst();

  const [sessionRes, channelsRes] = await Promise.all([
    db
      .from('user_sessions')
      .select('last_used_date')
      .eq('user_id', userId)
      .single(),
    db
      .from('channels')
      .select('youtube_channel_id, title, thumbnail_url, uploads_playlist_id')
      .eq('user_id', userId)
      .eq('is_selected', true),
  ]);

  // 初回ログインユーザはuser_sessionsテーブルにレコードがないため、
  // last_used_dateのデフォルト値を1970-01-01とする（Unixタイムスタンプ）
  const lastUsedDate = sessionRes.data?.last_used_date ?? '1970-01-01';
  const selectedChannels: SelectedChannel[] = channelsRes.data ?? [];
  if (selectedChannels.length === 0) return [];

  const channelIds = selectedChannels.map((c) => c.youtube_channel_id);

  const { data: existingPicks } = await db
    .from('daily_picks')
    .select('youtube_channel_id, youtube_video_id')
    .eq('user_id', userId)
    .eq('pick_date', todayDate)
    .in('youtube_channel_id', channelIds);

  const channelToVideoId = new Map<string, string>(
    (existingPicks ?? []).map(
      (p: { youtube_channel_id: string; youtube_video_id: string }) => [
        p.youtube_channel_id,
        p.youtube_video_id,
      ],
    ),
  );

  const channelsNeedingPick = selectedChannels.filter(
    (c) => !channelToVideoId.has(c.youtube_channel_id),
  );

  if (channelsNeedingPick.length > 0) {
    const newPickResults = await Promise.all(
      channelsNeedingPick.map(async (ch) => {
        const playlistId = await ensurePlaylistId(db, ch, accessToken);
        if (!playlistId) return null;

        const decision = await decideVideoForChannel(
          db,
          ch.youtube_channel_id,
          playlistId,
          lastUsedDate,
          accessToken,
        );
        if (!decision) return null;

        return {
          channelId: ch.youtube_channel_id,
          videoId: decision.videoId,
          reason: decision.reason,
        };
      }),
    );

    const newPicksToInsert = newPickResults.filter(
      (
        r,
      ): r is {
        channelId: string;
        videoId: string;
        reason: 'new' | 'random';
      } => r !== null,
    );

    if (newPicksToInsert.length > 0) {
      await db.from('daily_picks').upsert(
        newPicksToInsert.map((p) => ({
          user_id: userId,
          youtube_channel_id: p.channelId,
          youtube_video_id: p.videoId,
          pick_date: todayDate,
          pick_reason: p.reason,
        })),
        {
          onConflict: 'user_id,youtube_channel_id,pick_date',
          ignoreDuplicates: true,
        },
      );

      for (const p of newPicksToInsert) {
        channelToVideoId.set(p.channelId, p.videoId);
      }
    }
  }

  const allVideoIds = Array.from(channelToVideoId.values());
  if (allVideoIds.length === 0) {
    await db
      .from('user_sessions')
      .upsert(
        { user_id: userId, last_used_date: todayDate },
        { onConflict: 'user_id' },
      );
    return [];
  }

  const { data: videoRows } = await db
    .from('videos')
    .select(
      'youtube_video_id, title, thumbnail_url, duration_seconds, published_at',
    )
    .in('youtube_video_id', allVideoIds);

  const videoMap = new Map<string, VideoDetail>(
    (videoRows ?? []).map((v: VideoDetail) => [v.youtube_video_id, v]),
  );

  await db
    .from('user_sessions')
    .upsert(
      { user_id: userId, last_used_date: todayDate },
      { onConflict: 'user_id' },
    );

  return buildPicks(
    selectedChannels,
    channelToVideoId,
    videoMap,
    userId,
    todayDate,
  );
}
