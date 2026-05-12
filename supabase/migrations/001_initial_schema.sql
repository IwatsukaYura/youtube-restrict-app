-- App-specific tables (no NextAuth tables - using JWT sessions)

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  last_used_date date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  youtube_channel_id text NOT NULL,
  title text NOT NULL,
  thumbnail_url text,
  uploads_playlist_id text,
  is_selected boolean NOT NULL DEFAULT false,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, youtube_channel_id)
);

CREATE INDEX IF NOT EXISTS idx_channels_user_selected
  ON channels(user_id, is_selected);

-- is_shorts is set by the app from the YouTube player aspect ratio
-- (Shorts use a 9:16 embed). Duration alone is unreliable.
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id text NOT NULL UNIQUE,
  youtube_channel_id text NOT NULL,
  title text NOT NULL,
  thumbnail_url text,
  duration_seconds integer NOT NULL,
  is_shorts boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL,
  cached_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_videos_channel_published
  ON videos(youtube_channel_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_videos_channel_not_shorts
  ON videos(youtube_channel_id, published_at DESC)
  WHERE is_shorts = false;

CREATE TABLE IF NOT EXISTS daily_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  youtube_channel_id text NOT NULL,
  youtube_video_id text NOT NULL,
  pick_date date NOT NULL,
  pick_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, youtube_channel_id, pick_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_picks_user_date
  ON daily_picks(user_id, pick_date DESC);

-- Note: RLS is intentionally not enabled here.
-- The service_role key (used server-side only) bypasses RLS.
-- For a single-user personal tool, app-level user_id filtering in API routes is sufficient.
