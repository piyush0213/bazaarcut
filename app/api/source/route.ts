import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  DEMO_CLOUD_NAME,
  DEMO_PUBLIC_ID,
  deliverySet,
  isConfigured,
  uploadLocalFile,
} from "@/lib/cloudinary";
import { findSample } from "@/lib/samples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const UNCONFIGURED_NOTE =
  "Live generation is off. These three URLs use the documented demo cloud public id docs/guitar, so the transforms still open. They are not this photo. Add the three Cloudinary env vars, then upload again. Two image-to-image generations need the Image Generation add-on and spend free credits.";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const sampleId = form.get("sampleId");
    const file = form.get("file");

    if (typeof sampleId === "string" && sampleId.length > 0) {
      return await fromSample(sampleId);
    }
    if (file instanceof File) {
      return await fromUpload(file);
    }
    return fail("Choose a sample photo or upload one.", 400);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not prepare that photo.", 500);
  }
}

async function fromSample(sampleId: string) {
  const sample = findSample(sampleId);
  if (!sample) return fail("Unknown sample.", 400);

  const root = path.resolve(process.cwd(), "public", "samples");
  const filePath = path.resolve(root, sample.file);
  if (!filePath.startsWith(root + path.sep)) return fail("Unknown sample.", 400);

  const localPreview = `/samples/${sample.file}`;
  if (!isConfigured()) {
    return Response.json({
      ok: true,
      source: {
        label: sample.label,
        previewUrl: localPreview,
        publicId: DEMO_PUBLIC_ID,
        cloudName: DEMO_CLOUD_NAME,
        assetId: null,
        secureUrl: null,
        usedDemoCloud: true,
        note: UNCONFIGURED_NOTE,
        deliveries: deliverySet(DEMO_CLOUD_NAME, DEMO_PUBLIC_ID),
      },
    });
  }

  try {
    const uploaded = await uploadLocalFile(filePath, `bazaarcut/samples/${sample.id}`);
    return Response.json({
      ok: true,
      source: {
        label: sample.label,
        previewUrl: uploaded.secureUrl,
        publicId: uploaded.publicId,
        cloudName: uploaded.cloudName,
        assetId: uploaded.assetId,
        secureUrl: uploaded.secureUrl,
        usedDemoCloud: false,
        note: "Uploaded to your cloud. No generation credits used. The three URLs below transform this photo only.",
        deliveries: deliverySet(uploaded.cloudName, uploaded.publicId),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return fail(`Upload failed. ${message}`, 502);
  }
}

async function fromUpload(file: File) {
  if (file.size <= 0) return fail("That file is empty.", 400);
  if (file.size > MAX_BYTES) return fail("Photo must be 8 MB or smaller.", 400);
  const ext = extensionFor(file);
  if (!ext) return fail("Use a JPEG, PNG, or WebP photo.", 400);

  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = path.join(os.tmpdir(), "bazaarcut");
  await mkdir(dir, { recursive: true });
  const tempPath = path.join(dir, `${randomUUID()}.${ext}`);
  await writeFile(tempPath, bytes);

  try {
    if (!isConfigured()) {
      return Response.json({
        ok: true,
        source: {
          label: "Your photo",
          previewUrl: "",
          publicId: DEMO_PUBLIC_ID,
          cloudName: DEMO_CLOUD_NAME,
          assetId: null,
          secureUrl: null,
          usedDemoCloud: true,
          note: UNCONFIGURED_NOTE,
          deliveries: deliverySet(DEMO_CLOUD_NAME, DEMO_PUBLIC_ID),
        },
      });
    }

    const uploaded = await uploadLocalFile(tempPath, `bazaarcut/uploads/${randomUUID()}`);
    return Response.json({
      ok: true,
      source: {
        label: "Your photo",
        previewUrl: uploaded.secureUrl,
        publicId: uploaded.publicId,
        cloudName: uploaded.cloudName,
        assetId: uploaded.assetId,
        secureUrl: uploaded.secureUrl,
        usedDemoCloud: false,
        note: "Uploaded to your cloud. No generation credits used. The three URLs below transform this photo only.",
        deliveries: deliverySet(uploaded.cloudName, uploaded.publicId),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return fail(`Upload failed. ${message}`, 502);
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

function extensionFor(file: File): string | null {
  const fromType = ALLOWED.get(file.type);
  if (fromType) return fromType;
  const name = file.name.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";
  return null;
}

function fail(error: string, status: number) {
  return Response.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
