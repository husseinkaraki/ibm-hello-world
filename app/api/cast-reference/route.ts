import { loadLucyReference } from "../../../lib/cast-reference";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { bytes, mimeType } = await loadLucyReference();
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": mimeType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "Lucy's reference photo is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
