import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureDbSchema } from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  try {
    await ensureDbSchema();
    const user = await getSessionUser(req);
    return NextResponse.json({ user }, {
      headers: {
        "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
        "Pragma": "no-cache",
      }
    });
  } catch (err) {
    return NextResponse.json({ user: null }, {
      headers: {
        "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      }
    });
  }
}


