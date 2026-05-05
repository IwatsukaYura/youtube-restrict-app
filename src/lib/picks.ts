import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyPickWithDetails, YoutubeVideoMeta } from "@/types";
import {
  fetchRecentVideoIds,
  fetchVideoMetas,
  fetchUploadsPlaylistId,
  isShorts,
} from "@/lib/youtube";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getTodayJst(): string {
  const now = new Date(Date.now() + JST_OFFSET_MS);
  return now.toISOString().slice(0, 10);
}

async function getOrFetchUploadsPlaylistId(
  db: SupabaseClient,
  channelId: string,
  accessToken: string
): Promise<string | null> {
  const { data } = await db
    .from("channels")
    .select("uploads_playlist_id")
    .eq("youtube_channel_id", channelId)
    .single();

  if (data?.uploads_playlist_id) return data.uploads_playlist_id;

  const playlistId = await fetchUploadsPlaylistId(channelId, accessToken);
  if (playlistId) {
    await db
      .from("channels")
      .update({ uploads_playlist_id: playlistId })
      .eq("youtube_channel_id", channelId);
  }
  return playlistId;
}

async function cacheVideos(db: SupabaseClient, metas: YoutubeVideoMeta[]): Promise<void> {
  if (metas.length === 0) return;
  await db.from("videos").upsert(
    metas.map((m) => ({
      youtube_video_id: m.videoId,
      youtube_channel_id: m.channelId,
      title: m.title,
      thumbnail_url: m.thumbnailUrl,
      duration_seconds: m.durationSeconds,
      published_at: m.publishedAt,
    })),
    { onConflict: "youtube_video_id", ignoreDuplicates: true }
  );
}

async function pickVideoForChannel(
  db: SupabaseClient,
  userId: string,
  channelId: string,
  uploadsPlaylistId: string,
  lastUsedDate: string,
  today: string,
  accessToken: string
): Promise<string | null> {
  const { data: existing } = await db
    .from("daily_picks")
    .select("youtube_video_id")
    .eq("user_id", userId)
    .eq("youtube_channel_id", channelId)
    .eq("pick_date", today)
    .single();

  if (existing) return existing.youtube_video_id;

  const recent = await fetchRecentVideoIds(uploadsPlaylistId, accessToken, 50);
  const allVideoIds = recent.map((r) => r.videoId);

  const cachedMetas = await (async () => {
    if (allVideoIds.length === 0) return [];
    const { data } = await db
      .from("videos")
      .select("youtube_video_id, duration_seconds, published_at")
      .in("youtube_video_id", allVideoIds);
    return data ?? [];
  })();

  const cachedIds = new Set(cachedMetas.map((m: { youtube_video_id: string }) => m.youtube_video_id));
  const uncachedIds = allVideoIds.filter((id) => !cachedIds.has(id));

  if (uncachedIds.length > 0) {
    const freshMetas = await fetchVideoMetas(uncachedIds, accessToken);
    await cacheVideos(db, freshMetas);
    for (const m of freshMetas) {
      cachedMetas.push({
        youtube_video_id: m.videoId,
        duration_seconds: m.durationSeconds,
        published_at: m.publishedAt,
      });
    }
  }

  const nonShorts = cachedMetas.filter(
    (m: { duration_seconds: number }) => !isShorts(m.duration_seconds)
  );

  const newVideos = nonShorts
    .filter((m: { published_at: string }) => m.published_at > lastUsedDate)
    .sort((a: { published_at: string }, b: { published_at: string }) =>
      b.published_at.localeCompare(a.published_at)
    );

  let selectedVideoId: string;
  let pickReason: "new" | "random";

  if (newVideos.length > 0) {
    selectedVideoId = newVideos[0].youtube_video_id;
    pickReason = "new";
  } else if (nonShorts.length > 0) {
    const idx = Math.floor(Math.random() * nonShorts.length);
    selectedVideoId = nonShorts[idx].youtube_video_id;
    pickReason = "random";
  } else {
    return null;
  }

  await db.from("daily_picks").upsert(
    {
      user_id: userId,
      youtube_channel_id: channelId,
      youtube_video_id: selectedVideoId,
      pick_date: today,
      pick_reason: pickReason,
    },
    { onConflict: "user_id,youtube_channel_id,pick_date", ignoreDuplicates: true }
  );

  return selectedVideoId;
}

export async function generateDailyPicks(
  db: SupabaseClient,
  userId: string,
  accessToken: string
): Promise<DailyPickWithDetails[]> {
  const today = getTodayJst();

  const { data: sessionData } = await db
    .from("user_sessions")
    .select("last_used_date")
    .eq("user_id", userId)
    .single();

  const lastUsedDate = sessionData?.last_used_date ?? "1970-01-01";

  const { data: selectedChannels } = await db
    .from("channels")
    .select("youtube_channel_id, title, thumbnail_url, uploads_playlist_id")
    .eq("user_id", userId)
    .eq("is_selected", true);

  if (!selectedChannels || selectedChannels.length === 0) return [];

  const picks: DailyPickWithDetails[] = [];

  for (const ch of selectedChannels) {
    let playlistId = ch.uploads_playlist_id;
    if (!playlistId) {
      playlistId = await getOrFetchUploadsPlaylistId(db, ch.youtube_channel_id, accessToken);
    }
    if (!playlistId) continue;

    const videoId = await pickVideoForChannel(
      db,
      userId,
      ch.youtube_channel_id,
      playlistId,
      lastUsedDate,
      today,
      accessToken
    );
    if (!videoId) continue;

    const { data: videoData } = await db
      .from("videos")
      .select("youtube_video_id, title, thumbnail_url, duration_seconds, published_at")
      .eq("youtube_video_id", videoId)
      .single();

    if (!videoData) continue;

    picks.push({
      id: "",
      userId,
      youtubeChannelId: ch.youtube_channel_id,
      youtubeVideoId: videoId,
      pickDate: today,
      pickReason: "new",
      createdAt: new Date().toISOString(),
      channel: {
        youtubeChannelId: ch.youtube_channel_id,
        title: ch.title,
        thumbnailUrl: ch.thumbnail_url,
      },
      video: {
        youtubeVideoId: videoData.youtube_video_id,
        title: videoData.title,
        thumbnailUrl: videoData.thumbnail_url,
        durationSeconds: videoData.duration_seconds,
        publishedAt: videoData.published_at,
      },
    });
  }

  await db.from("user_sessions").upsert(
    { user_id: userId, last_used_date: today },
    { onConflict: "user_id" }
  );

  return picks;
}
