import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createServiceClient } from '@/lib/supabase';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceClient();
  //ユーザーのYoutube登録チャンネルを取得する
  const { data, error } = await db
    .from('channels')
    .select(
      'id, youtube_channel_id, title, thumbnail_url, is_selected, synced_at',
    )
    .eq('user_id', session.user.id)
    .order('title', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { selected: string[] };
  if (!Array.isArray(body.selected)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: allChannels } = await db
    .from('channels')
    .select('youtube_channel_id')
    .eq('user_id', session.user.id);

  if (!allChannels) return NextResponse.json({ ok: true });

  const selectedSet = new Set(body.selected);

  const updates = allChannels.map((ch: { youtube_channel_id: string }) =>
    db
      .from('channels')
      .update({ is_selected: selectedSet.has(ch.youtube_channel_id) })
      .eq('user_id', session.user.id)
      .eq('youtube_channel_id', ch.youtube_channel_id),
  );

  await Promise.all(updates);

  return NextResponse.json({ ok: true });
}
