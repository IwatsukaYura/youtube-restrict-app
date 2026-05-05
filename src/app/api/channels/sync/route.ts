import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createServiceClient } from "@/lib/supabase";
import { fetchSubscriptions, fetchUploadsPlaylistId } from "@/lib/youtube";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const { accessToken, user } = session;

  const subscriptions = await fetchSubscriptions(accessToken);

  const { data: existingChannels } = await db
    .from("channels")
    .select("youtube_channel_id, uploads_playlist_id")
    .eq("user_id", user.id);

  const existingMap = new Map(
    (existingChannels ?? []).map(
      (c: { youtube_channel_id: string; uploads_playlist_id: string | null }) => [
        c.youtube_channel_id,
        c.uploads_playlist_id,
      ]
    )
  );

  const upsertRows = await Promise.all(
    subscriptions.map(async (sub) => {
      let uploadsPlaylistId = existingMap.get(sub.channelId) ?? null;
      if (!uploadsPlaylistId) {
        uploadsPlaylistId = await fetchUploadsPlaylistId(sub.channelId, accessToken);
      }
      return {
        user_id: user.id,
        youtube_channel_id: sub.channelId,
        title: sub.title,
        thumbnail_url: sub.thumbnailUrl,
        uploads_playlist_id: uploadsPlaylistId,
        synced_at: new Date().toISOString(),
      };
    })
  );

  const { error } = await db
    .from("channels")
    .upsert(upsertRows, { onConflict: "user_id,youtube_channel_id", ignoreDuplicates: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ synced: upsertRows.length });
}
