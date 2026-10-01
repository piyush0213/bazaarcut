/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { SAMPLES } from "@/lib/samples";
import type { Delivery, ModelPreference, SourceAsset, Variant } from "@/lib/types";

type Selection = "source" | ModelPreference;

const MAX_BYTES = 8 * 1024 * 1024;

export default function PackApp() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [source, setSource] = useState<SourceAsset | null>(null);
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [selected, setSelected] = useState<Selection>("source");
  const [busy, setBusy] = useState<null | "source" | "generate">(null);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => {
        if (!cancelled) setConfigured(Boolean(data.configured));
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const chosen = currentDeliveries(source, variants, selected);
  const anySucceeded = Boolean(variants?.some((variant) => variant.publicId));

  async function chooseSample(id: string) {
    const seq = ++requestSeq.current;
    setError(null);
    setBusy("source");
    setActiveSample(id);
    setVariants(null);
    setSelected("source");
    const body = new FormData();
    body.set("sampleId", id);
    try {
      const next = await postSource(body);
      if (seq !== requestSeq.current) return;
      setSource(next);
      setLocalPreview(null);
    } catch (caught) {
      if (seq !== requestSeq.current) return;
      setError(caught instanceof Error ? caught.message : "Could not open that sample.");
    } finally {
      if (seq === requestSeq.current) setBusy(null);
    }
  }

  async function chooseFile(file: File | null) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("Photo must be 8 MB or smaller.");
      return;
    }
    const seq = ++requestSeq.current;
    setError(null);
    setBusy("source");
    setActiveSample(null);
    setVariants(null);
    setSelected("source");
    const preview = URL.createObjectURL(file);
    const body = new FormData();
    body.set("file", file);
    try {
      const next = await postSource(body);
      if (seq !== requestSeq.current) {
        URL.revokeObjectURL(preview);
        return;
      }
      if (!next.previewUrl) next.previewUrl = preview;
      setLocalPreview(preview);
      setSource(next);
    } catch (caught) {
      URL.revokeObjectURL(preview);
      if (seq !== requestSeq.current) return;
      setError(caught instanceof Error ? caught.message : "Could not upload that photo.");
    } finally {
      if (seq === requestSeq.current) setBusy(null);
    }
  }

  async function generate() {
    if (!source || source.usedDemoCloud || !source.secureUrl) return;
    setError(null);
    setBusy("generate");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: source.assetId,
          secureUrl: source.secureUrl,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        variants?: Variant[];
      } | null;
      if (data?.variants?.length) setVariants(data.variants);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Generation failed (${response.status}).`);
      }
      setSelected("source");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Generation failed.");
    } finally {
      setBusy(null);
    }
  }

  const preview = source?.previewUrl || localPreview;

  return (
    <main className="app">
      <header className="top">
        <div>
          <h1 className="wordmark">BazaarCut</h1>
          <p className="lede">
            One flat-lay photo becomes a Meesho catalog cutout, an Instagram square, and a story.
          </p>
        </div>
        <p className="track">
          PS-02
          <br />
          Track 2
        </p>
      </header>

      {configured === false && (
        <p className="banner">
          Cloudinary env vars are not set. Samples still open three real transform URLs on the
          demo cloud (public id docs/guitar). Live generation stays off until you add credentials.
          Two generations spend Image Generation credits.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="step">
        <h2>1. Pick a photo</h2>
        <div className="samples">
          {SAMPLES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              className="sample"
              aria-pressed={activeSample === sample.id}
              onClick={() => chooseSample(sample.id)}
              disabled={busy !== null}
            >
              <img src={`/samples/${sample.file}`} alt={sample.label} />
              <span>{sample.label}</span>
            </button>
          ))}
        </div>
        <div className="row">
          <label className="file-btn">
            Upload a photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy !== null}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                void chooseFile(file);
              }}
            />
          </label>
          {busy === "source" && <span className="hint">Preparing the photo…</span>}
        </div>
        <p className="hint">JPEG, PNG, or WebP. 8 MB max. Samples are original drawings, not brand photos.</p>
      </section>

      {source && (
        <section className="step">
          <h2>2. Compare two models, or skip</h2>
          <p className="note">{source.note}</p>
          <div className="split two">
            <article className={selected === "source" ? "card picked" : "card"}>
              <h3>Original</h3>
              <p className="meta">No model. This is the uploaded photo.</p>
              {preview && <img src={preview} alt={source.label} />}
              <div className="row">
                <button type="button" className="ghost" onClick={() => setSelected("source")}>
                  Use original
                </button>
              </div>
            </article>
            <article className="card">
              <h3>Two generations</h3>
              <p className="hint">
                Runs image-to-image twice: model mode auto, preferences quality_fast and
                economy_fast. That is the cap. It spends free Image Generation credits. The first
                Console generation subscribes you to the free add-on plan.
              </p>
              <div className="row">
                <button
                  type="button"
                  className="primary"
                  disabled={
                    busy !== null ||
                    configured !== true ||
                    source.usedDemoCloud ||
                    !source.secureUrl ||
                    anySucceeded
                  }
                  onClick={() => void generate()}
                >
                  {busy === "generate" ? "Generating two…" : "Generate two versions"}
                </button>
              </div>
              {anySucceeded && (
                <p className="small">A version came back. Generating again would spend more credits.</p>
              )}
            </article>
          </div>

          {variants && (
            <div className="split two" style={{ marginTop: 10 }}>
              {variants.map((variant) => (
                <article
                  key={variant.preference}
                  className={selected === variant.preference ? "card picked" : "card"}
                >
                  <h3>{labelFor(variant.preference)}</h3>
                  <p className="meta">preference {variant.preference}</p>
                  <p className="meta">model id {variant.modelId ?? "unavailable"}</p>
                  {(variant.family || variant.tier) && (
                    <p className="meta">
                      family {variant.family ?? "—"} · tier {variant.tier ?? "—"}
                    </p>
                  )}
                  {variant.error && <p className="error">{variant.error}</p>}
                  {variant.secureUrl && (
                    <img src={variant.secureUrl} alt={`${labelFor(variant.preference)} preview`} />
                  )}
                  <div className="row">
                    <button
                      type="button"
                      className="ghost"
                      disabled={!variant.publicId}
                      onClick={() => setSelected(variant.preference)}
                    >
                      Use this one
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {chosen && (
        <section className="step">
          <h2>3. Deliver the picked photo</h2>
          <p className="hint">
            Only this public id is delivered: {chosen.publicId}. First background-removal open can
            take a few seconds.
          </p>
          <div className="split three">
            {chosen.deliveries.map((item) => (
              <DeliveryCard key={item.url} item={item} />
            ))}
          </div>
        </section>
      )}

      <footer>
        BazaarCut · Pixels to Products · Cloudinary AI Hackathon 2026 · PS-02. Not submitted.
      </footer>
    </main>
  );
}

function DeliveryCard({ item }: { item: Delivery }) {
  const [broken, setBroken] = useState(false);
  const frame = item.key === "catalog" ? "checker" : item.key === "story" ? "story-frame" : "";
  return (
    <article className="card">
      <h3>{item.title}</h3>
      <p className="small">{item.detail}</p>
      <div className={frame}>
        {broken ? (
          <p className="small">
            Not ready yet. Cloudinary can return 423 the first time it builds this derived image.
            Open the URL again in a moment.
          </p>
        ) : (
          <img src={item.url} alt={item.title} onError={() => setBroken(true)} />
        )}
      </div>
      <p className="url">{item.url}</p>
      <div className="links">
        <a href={item.url} target="_blank" rel="noreferrer">
          Open
        </a>
        <a href={item.downloadUrl}>Download</a>
      </div>
    </article>
  );
}

function labelFor(preference: ModelPreference): string {
  if (preference === "quality_fast") return "Quality fast";
  return "Economy fast";
}

function currentDeliveries(
  source: SourceAsset | null,
  variants: Variant[] | null,
  selected: Selection,
): { publicId: string; deliveries: Delivery[] } | null {
  if (!source) return null;
  if (selected !== "source") {
    const variant = variants?.find((item) => item.preference === selected && item.publicId);
    if (variant?.publicId) {
      return { publicId: variant.publicId, deliveries: variant.deliveries };
    }
  }
  return { publicId: source.publicId, deliveries: source.deliveries };
}

async function postSource(body: FormData): Promise<SourceAsset> {
  const response = await fetch("/api/source", { method: "POST", body });
  const data = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    source?: SourceAsset;
  } | null;
  if (!response.ok || !data?.ok || !data.source) {
    throw new Error(data?.error || `Could not prepare that photo (${response.status}).`);
  }
  return data.source;
}
