import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createServiceClient } from '@/lib/supabase';
import { generateDailyPicks } from '@/lib/picks';

export async function GET() {
  const session = await auth();

  const userId = session?.user?.id;
  const accessToken = session?.accessToken;
  if (!userId || !accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceClient();
  // Generate picks for today if not already generated
  const picks = await generateDailyPicks(db, userId, accessToken);

  return NextResponse.json(picks);
}
