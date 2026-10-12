import { NextResponse } from "next/server";
import { apiKey, IS_DESKTOP, saveApiKeys } from "@/lib/settings";

export const dynamic = "force-dynamic";

// GET /api/settings — indica si las claves están configuradas (nunca las devuelve).
export async function GET() {
  return NextResponse.json({
    desktop: IS_DESKTOP,
    openai: !!apiKey("OPENAI_APIKEY"),
    replicate: !!apiKey("REPLICATE_APIKEY"),
  });
}

// PUT /api/settings — guarda las claves. Solo en la app de escritorio.
export async function PUT(req: Request) {
  if (!IS_DESKTOP) {
    return NextResponse.json({ error: "Las claves se configuran en el servidor." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  saveApiKeys({ OPENAI_APIKEY: body.openai, REPLICATE_APIKEY: body.replicate });
  return NextResponse.json({ ok: true });
}
