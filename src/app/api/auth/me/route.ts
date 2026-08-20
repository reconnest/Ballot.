import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureDbSchema } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureDbSchema();
    const user = await getSessionUser(req);
    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json({ user: null });
  }
}

