import type { YoutubeSubscription, YoutubeVideoMeta } from "@/types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const SHORTS_MAX_SECONDS = 60;

function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = Number(match[1] ?? 0);
  const m = Number(match[2] ?? 0);
  const s = Number(match[3] ?? 0);
  return h * 3600 + m * 60 + s;
}

async function youtubeGet(
  path: string,
  params: Record<string, string>,
  accessToken: string
): Promise<unknown> {
  const url = new URL(`${YOUTUBE_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API error ${res.status}: ${body}`);
  }

  return res.json();
}

export async function fetchSubscriptions(accessToken: string): Promise<YoutubeSubscription[]> {
  const results: YoutubeSubscription[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: "snippet",
      mine: "true",
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const data = (await youtubeGet("/subscriptions", params, accessToken)) as {
      items?: Array<{
        snippet: {
          resourceId: { channelId: string };
          title: string;
          thumbnails: { default?: { url: string } };
        };
      }>;
      nextPageToken?: string;
    };

    for (const item of data.items ?? []) {
      results.push({
        channelId: item.snippet.resourceId.channelId,
        title: item.snippet.title,
        thumbnailUrl: item.snippet.thumbnails.default?.url ?? "",
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return results;
}

export async function fetchUploadsPlaylistId(
  channelId: string,
  accessToken: string
): Promise<string | null> {
  const data = (await youtubeGet(
    "/channels",
    { part: "contentDetails", id: channelId },
    accessToken
  )) as {
    items?: Array<{
      contentDetails: { relatedPlaylists: { uploads: string } };
    }>;
  };

  return data.items?.[0]?.contentDetails.relatedPlaylists.uploads ?? null;
}

export async function fetchRecentVideoIds(
  uploadsPlaylistId: string,
  accessToken: string,
  maxResults = 50
): Promise<Array<{ videoId: string; publishedAt: string }>> {
  const data = (await youtubeGet(
    "/playlistItems",
    {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: String(maxResults),
    },
    accessToken
  )) as {
    items?: Array<{
      contentDetails: { videoId: string; videoPublishedAt: string };
    }>;
  };

  return (data.items ?? []).map((item) => ({
    videoId: item.contentDetails.videoId,
    publishedAt: item.contentDetails.videoPublishedAt,
  }));
}

export async function fetchVideoMetas(
  videoIds: string[],
  accessToken: string
): Promise<YoutubeVideoMeta[]> {
  if (videoIds.length === 0) return [];

  const results: YoutubeVideoMeta[] = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = (await youtubeGet(
      "/videos",
      {
        part: "snippet,contentDetails",
        id: batch.join(","),
      },
      accessToken
    )) as {
      items?: Array<{
        id: string;
        snippet: {
          channelId: string;
          title: string;
          publishedAt: string;
          thumbnails: { medium?: { url: string } };
        };
        contentDetails: { duration: string };
      }>;
    };

    for (const item of data.items ?? []) {
      results.push({
        videoId: item.id,
        channelId: item.snippet.channelId,
        title: item.snippet.title,
        thumbnailUrl: item.snippet.thumbnails.medium?.url ?? "",
        durationSeconds: parseDuration(item.contentDetails.duration),
        publishedAt: item.snippet.publishedAt,
      });
    }
  }

  return results;
}

export function isShorts(durationSeconds: number): boolean {
  return durationSeconds <= SHORTS_MAX_SECONDS;
}
