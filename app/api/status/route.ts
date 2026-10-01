import { isConfigured } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { ok: true, configured: isConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
