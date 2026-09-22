import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe for Docker / Coolify healthchecks. */
export function GET() {
  return NextResponse.json({ ok: true });
}
