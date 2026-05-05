import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createServiceClient } from "@/lib/supabase";
import { generateDailyPicks } from "@/lib/picks";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const picks = await generateDailyPicks(db, session.user.id, session.accessToken);

  return NextResponse.json(picks);
}
