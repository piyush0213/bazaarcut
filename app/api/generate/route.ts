import { deliverySet, generatePair, isConfigured } from "@/lib/cloudinary";
import type { Variant } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isConfigured()) {
    return Response.json(
      {
        ok: false,
        error:
          "Live generation needs CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET. It also needs the Image Generation add-on. Free credits are limited. This button runs two generations.",
      },
      { status: 400 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Request body must be JSON." }, { status: 400 });
  }

  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const assetId = typeof body.assetId === "string" ? body.assetId : null;
  const secureUrl = typeof body.secureUrl === "string" ? body.secureUrl : null;

  try {
    const pair = await generatePair({ assetId, secureUrl });
    const variants: Variant[] = pair.map((item) => {
      if (!item.asset) {
        return {
          preference: item.preference,
          modelId: null,
          family: null,
          tier: null,
          publicId: null,
          secureUrl: null,
          deliveries: [],
          error: item.error ?? "Generation failed.",
        };
      }
      return {
        preference: item.preference,
        modelId: item.asset.modelId,
        family: item.asset.family,
        tier: item.asset.tier,
        publicId: item.asset.publicId,
        secureUrl: item.asset.secureUrl,
        deliveries: deliverySet(cloudFromUrl(item.asset.secureUrl), item.asset.publicId),
        error: null,
      };
    });

    const ready = variants.filter((variant) => variant.publicId);
    if (ready.length === 0) {
      const detail = variants.map((variant) => `${variant.preference}: ${variant.error}`).join(" ");
      return Response.json(
        {
          ok: false,
          error: `Both generations failed. ${detail}`.trim(),
          variants,
        },
        { status: 502 },
      );
    }

    return Response.json({
      ok: true,
      note: "Two generations finished. Pick one. Only the picked asset is used for the three delivery URLs.",
      variants,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}

function cloudFromUrl(secureUrl: string): string {
  try {
    const pathname = new URL(secureUrl).pathname;
    const [cloud] = pathname.split("/").filter(Boolean);
    if (cloud) return cloud;
  } catch {
    /* fall through */
  }
  return (process.env.CLOUDINARY_CLOUD_NAME ?? "").trim();
}
