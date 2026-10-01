import { v2 as cloudinary } from "cloudinary";
import type { Delivery, ModelPreference } from "@/lib/types";

/**
 * Documented demo product environment and public id.
 * AI in Action uses docs/guitar with e_background_removal:
 * https://cloudinary.com/documentation/ai_in_action
 * Verified: https://res.cloudinary.com/demo/image/upload/e_background_removal/e_dropshadow/f_auto,q_auto/docs/guitar
 */
export const DEMO_CLOUD_NAME = "demo";
export const DEMO_PUBLIC_ID = "docs/guitar";

const PREFERENCES: ModelPreference[] = ["quality_fast", "economy_fast"];

const PROMPT =
  "Use the product in [1] as the only subject. Keep its shape, color, and construction. Make a clean square catalog photo for a Meesho and Instagram reseller: centered product, soft daylight, simple uncluttered background. Do not add text, logos, watermarks, hands, or extra objects.";

export function isConfigured(): boolean {
  return Boolean(cloudName() && apiKey() && apiSecret());
}

export function cloudName(): string {
  return (process.env.CLOUDINARY_CLOUD_NAME ?? "").trim();
}

function apiKey(): string {
  return (process.env.CLOUDINARY_API_KEY ?? "").trim();
}

function apiSecret(): string {
  return (process.env.CLOUDINARY_API_SECRET ?? "").trim();
}

function applyCredentials(): { cloudName: string; apiKey: string; apiSecret: string } {
  const name = cloudName();
  const key = apiKey();
  const secret = apiSecret();
  if (!name || !key || !secret) {
    throw new Error(
      "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env.local.",
    );
  }
  cloudinary.config({
    cloud_name: name,
    api_key: key,
    api_secret: secret,
    secure: true,
  });
  return { cloudName: name, apiKey: key, apiSecret: secret };
}

function scrub(message: string): string {
  let out = message;
  const secret = apiSecret();
  const key = apiKey();
  if (secret) out = out.split(secret).join("[secret]");
  if (key) out = out.split(key).join("[key]");
  return out.slice(0, 600);
}

export function deliverySet(cloud: string, publicId: string): Delivery[] {
  const specs: Array<{
    key: Delivery["key"];
    title: string;
    detail: string;
    downloadName: string;
    transformation: Record<string, string | number>[];
  }> = [
    {
      key: "catalog",
      title: "Catalog",
      detail: "Background removal and drop shadow",
      downloadName: "bazaarcut-catalog",
      transformation: [
        { effect: "background_removal" },
        { effect: "dropshadow" },
        { fetch_format: "auto", quality: "auto" },
      ],
    },
    {
      key: "square",
      title: "Square 1:1",
      detail: "Content-aware crop, 1080×1080",
      downloadName: "bazaarcut-square",
      transformation: [
        { crop: "auto", gravity: "auto", width: 1080, height: 1080 },
        { fetch_format: "auto", quality: "auto" },
      ],
    },
    {
      key: "story",
      title: "Story 9:16",
      detail: "Content-aware crop, 1080×1920",
      downloadName: "bazaarcut-story",
      transformation: [
        { crop: "auto", gravity: "auto", width: 1080, height: 1920 },
        { fetch_format: "auto", quality: "auto" },
      ],
    },
  ];

  return specs.map((spec) => ({
    key: spec.key,
    title: spec.title,
    detail: spec.detail,
    url: buildUrl(cloud, publicId, spec.transformation),
    downloadUrl: buildUrl(cloud, publicId, [
      ...spec.transformation,
      { flags: `attachment:${spec.downloadName}` },
    ]),
  }));
}

function buildUrl(
  cloud: string,
  publicId: string,
  transformation: Record<string, string | number>[],
): string {
  return cloudinary.url(publicId, {
    cloud_name: cloud,
    secure: true,
    force_version: false,
    urlAnalytics: false,
    transformation,
  });
}

export async function uploadLocalFile(
  filePath: string,
  publicId: string,
): Promise<{ publicId: string; secureUrl: string; assetId: string | null; cloudName: string }> {
  const creds = applyCredentials();
  const result = await cloudinary.uploader.upload(filePath, {
    public_id: publicId,
    overwrite: true,
    invalidate: true,
    resource_type: "image",
    unique_filename: false,
  });
  const assetId = typeof result.asset_id === "string" ? result.asset_id : null;
  return {
    publicId: result.public_id,
    secureUrl: result.secure_url,
    assetId,
    cloudName: creds.cloudName,
  };
}

export type GeneratedAsset = {
  preference: ModelPreference;
  publicId: string;
  secureUrl: string;
  assetId: string | null;
  modelId: string | null;
  family: string | null;
  tier: string | null;
};

export async function generatePair(input: {
  assetId: string | null;
  secureUrl: string | null;
}): Promise<Array<{ preference: ModelPreference; asset: GeneratedAsset | null; error: string | null }>> {
  const creds = applyCredentials();
  if (!input.assetId && !input.secureUrl) {
    throw new Error("Upload a photo before generating. There is no reference image.");
  }
  if (input.secureUrl && !isOwnDeliveryUrl(input.secureUrl, creds.cloudName)) {
    throw new Error("Reference image must be an image you just uploaded to your Cloudinary cloud.");
  }
  if (input.assetId && !/^[a-f0-9]{16,64}$/i.test(input.assetId)) {
    throw new Error("Reference asset id was not valid. Upload the photo again.");
  }

  const results = await Promise.all(
    PREFERENCES.map(async (preference) => {
      try {
        const asset = await generateOne(creds, preference, input);
        return { preference, asset, error: null };
      } catch (error) {
        return { preference, asset: null, error: scrub(readable(error)) };
      }
    }),
  );
  return results;
}

async function generateOne(
  creds: { cloudName: string; apiKey: string; apiSecret: string },
  preference: ModelPreference,
  input: { assetId: string | null; secureUrl: string | null },
): Promise<GeneratedAsset> {
  const reference = input.assetId
    ? { source_type: "managed_asset", asset_id: input.assetId }
    : { source_type: "url", url: input.secureUrl };

  const publicId = `bazaarcut/gen/${Date.now()}-${preference.replaceAll("_", "-")}`;
  const body = {
    prompt: PROMPT,
    reference_images: [reference],
    model: {
      mode: "auto",
      preference,
    },
    image_size: {
      aspect_ratio: "1:1",
      resolution: "1K",
    },
    target: {
      target_type: "managed_asset",
      public_id: publicId,
    },
  };

  const response = await authorizedFetch(
    creds,
    `https://api.cloudinary.com/v2/generate/${encodeURIComponent(creds.cloudName)}/image_to_image`,
    { method: "POST", body: JSON.stringify(body) },
  );

  if (response.status === 202) {
    const taskId = readTaskId(response.body);
    if (!taskId) {
      throw new Error("Cloudinary accepted the job but did not return a task_id.");
    }
    const polled = await pollTask(creds, taskId);
    return toGenerated(preference, polled);
  }

  if (!response.ok) {
    throw new Error(errorMessage(response.body, response.status));
  }

  const asset = extractAsset(response.body);
  if (!asset) {
    throw new Error("Cloudinary did not return a stored image. Nothing was selected.");
  }
  return toGenerated(preference, asset);
}

async function pollTask(
  creds: { cloudName: string; apiKey: string; apiSecret: string },
  taskId: string,
): Promise<ExtractedAsset> {
  const deadline = Date.now() + 48_000;
  let lastStatus = "pending";
  while (Date.now() < deadline) {
    await sleep(2000);
    const response = await authorizedFetch(
      creds,
      `https://api.cloudinary.com/v2/generate/${encodeURIComponent(creds.cloudName)}/tasks/${encodeURIComponent(taskId)}`,
      { method: "GET" },
    );
    if (!response.ok) {
      throw new Error(errorMessage(response.body, response.status));
    }
    const asset = extractAsset(response.body);
    if (asset) return asset;
    lastStatus = readStatus(response.body) ?? lastStatus;
    if (["failed", "error", "aborted", "cancelled", "canceled"].includes(lastStatus)) {
      throw new Error(errorMessage(response.body, response.status));
    }
  }
  throw new Error(
    `Generation stayed ${lastStatus} too long. Check the Media Library before trying again so you do not spend another two credits.`,
  );
}

type ExtractedAsset = {
  publicId: string;
  secureUrl: string;
  assetId: string | null;
  modelId: string | null;
  family: string | null;
  tier: string | null;
};

function toGenerated(preference: ModelPreference, asset: ExtractedAsset): GeneratedAsset {
  return { preference, ...asset };
}

async function authorizedFetch(
  creds: { apiKey: string; apiSecret: string },
  url: string,
  init: { method: string; body?: string },
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const token = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString("base64");
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Basic ${token}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body,
      signal: AbortSignal.timeout(50_000),
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(readable(error));
  }
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { message: text.slice(0, 400) };
    }
  }
  return { ok: response.ok, status: response.status, body };
}

function extractAsset(body: unknown): ExtractedAsset | null {
  const root = record(body);
  const data = record(root?.data);
  if (!data) return null;
  const result = record(data.result);
  const nested = result ? record(result.data) : null;
  const buckets = [data.assets, result?.assets, nested?.assets];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket) || bucket.length === 0) continue;
    const asset = record(bucket[0]);
    if (!asset) continue;
    const storage = record(asset.storage) ?? {};
    const model = record(asset.model) ?? {};
    const publicId = str(storage.public_id);
    const secureUrl = str(storage.secure_url);
    if (!publicId || !secureUrl) continue;
    return {
      publicId,
      secureUrl,
      assetId: str(storage.asset_id),
      modelId: str(model.id),
      family: str(model.family),
      tier: str(model.tier),
    };
  }
  return null;
}

function readTaskId(body: unknown): string | null {
  return str(record(record(body)?.data)?.task_id);
}

function readStatus(body: unknown): string | null {
  return str(record(record(body)?.data)?.status);
}

function errorMessage(body: unknown, status: number): string {
  const root = record(body);
  const err = root?.error;
  const errRecord = record(err);
  const msg =
    (typeof err === "string" ? err : null) ??
    str(errRecord?.message) ??
    str(root?.message) ??
    `Cloudinary returned HTTP ${status}.`;
  const requestId = str(root?.request_id);
  return requestId ? `${msg} (request ${requestId})` : msg;
}

function isOwnDeliveryUrl(value: string, name: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.startsWith(`/${name}/image/upload/`)
    );
  } catch {
    return false;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readable(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return "Cloudinary took too long to answer. Check the Media Library before trying again so you do not spend another two credits.";
    }
    return error.message;
  }
  return "Cloudinary request failed.";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
