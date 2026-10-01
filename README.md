# BazaarCut

Pixels to Products, Cloudinary AI Hackathon 2026.

**Track 2 / PS-02 — Generative Content Workflows.** The problem is generative content workflows: AI image generation, including variations and model choice, inside a pipeline.

This project is not submitted.

## What it does

BazaarCut turns one flat-lay product photo into a reseller pack:

1. Upload a photo, or pick one of five bundled samples.
2. Optionally run Cloudinary image-to-image **twice** on that photo, with `model.mode` `auto` and two preferences: `quality_fast` and `economy_fast`. Each preview shows the model id Cloudinary actually ran.
3. Pick one asset. Only that public id is delivered.
4. Three URLs, all with `f_auto,q_auto`:
   - Catalog: `e_background_removal` then `e_dropshadow`
   - Square 1:1: content-aware crop `c_auto,g_auto` at 1080×1080
   - Story 9:16: content-aware crop `c_auto,g_auto` at 1080×1920

It is for Instagram and Meesho resellers in India who only have a phone flat-lay and need a catalog cutout, a square post, and a story from that one frame.

Samples are original drawings (brass diya, cotton kurta, clay mug, spice jar, jute bag). They are not brand photos.

## How Cloudinary is used

Secrets stay on the server (`CLOUDINARY_API_SECRET` is never sent to the browser).

1. **Upload** (only when env vars are set), via the Node SDK, which signs:
   - `POST https://api.cloudinary.com/v1_1/<cloud>/image/upload`
   - `public_id`, `overwrite`, `invalidate`, `resource_type=image`
2. **Image-to-image** (only when you click Generate two versions), two calls:
   - `POST https://api.cloudinary.com/v2/generate/<cloud>/image_to_image`
   - HTTP Basic auth (API key as username, API secret as password)
   - `prompt` (the product is reference `[1]`)
   - `reference_images[0].source_type`: `managed_asset` with `asset_id` from the upload, or `url` with the asset `secure_url` if there is no asset id
   - `model.mode`: `auto`
   - `model.preference`: `quality_fast` on the first call, `economy_fast` on the second
   - `image_size.aspect_ratio`: `1:1`
   - `image_size.resolution`: `1K`
   - `target.target_type`: `managed_asset`
   - `target.public_id`: `bazaarcut/gen/<timestamp>-quality-fast` or `...-economy-fast`
   - Model id is read from `data.assets[].model.id` (also `family` and `tier`)
3. **Async fallback**, only if that POST returns HTTP 202:
   - `GET https://api.cloudinary.com/v2/generate/<cloud>/tasks/<task_id>`
   - The asset is read from `data.result.assets[]` when the task finishes
4. **Delivery URLs** on the picked public id (no extra generation):
   - Catalog: `/e_background_removal/e_dropshadow/f_auto,q_auto/`
   - Square: `/c_auto,g_auto,h_1080,w_1080/f_auto,q_auto/`
   - Story: `/c_auto,g_auto,h_1920,w_1080/f_auto,q_auto/`
   - Download links add `fl_attachment:<filename>`

Without env vars, those same three URL shapes are built on the documented demo cloud public id `docs/guitar` (`res.cloudinary.com/demo`). The page says so. Your photo is not sent anywhere.

Docs followed: [Image Generation](https://cloudinary.com/documentation/image_generation_addon), [AI in Action](https://cloudinary.com/documentation/ai_in_action), [Background removal](https://cloudinary.com/documentation/background_removal). The hackathon starter is still `npx create-cloudinary-next` on [cld.media/hackathons](https://www.cld.media/hackathons). This app was scaffolded with `create-next-app` (App Router, TypeScript) because that starter is interactive, and it uses the `cloudinary` npm package.

## Setup

1. Create a free Cloudinary account.
2. Register the Image Generation add-on. The first generation in the Cloudinary Console subscribes you to the free plan. Free credits are limited. The hackathon page does not mention this. Upgrade only if you want more than the free allotment. Paid Image Generation plans are separate from the Cloudinary account plan.
3. If the product environment uses strict transformations, allow `e_background_removal`, `e_dropshadow`, `c_auto`, `f_auto`, and `q_auto`, or turn strict mode off for the demo. The first on-the-fly background removal can return HTTP 423 until Cloudinary caches the derived image.
4. Copy env vars from the API Keys page:

```bash
cp .env.example .env.local
```

```
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

5. Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How to test

### Samples, no generation credits

1. Do not click **Generate two versions**.
2. Pick a sample (for example Brass diya).
3. With env vars set, the app signed-uploads that drawing and shows three transform URLs for **that** public id. Upload does not spend Image Generation credits.
4. With env vars missing, the three URLs still load. They use demo cloud `docs/guitar`, and the page says they are not your photo.

Background removal and the crops run when the browser requests the delivery URL. That uses transformation quota, not the image-generation credit pool.

### Live generation

1. Fill in `.env.local` and restart `npm run dev`.
2. In the Console, open Image → Image Generation once if you have not subscribed to the add-on yet.
3. Pick a sample or upload a photo. Wait until it is on your cloud.
4. Click **Generate two versions**. The button makes exactly two `image_to_image` calls, then disables itself so a second click does not spend another pair.
5. Confirm both cards show a model id (`data.assets[].model.id`).
6. Pick one card. The catalog, square, and story URLs must all use that public id and no other.
7. Open each URL and use Download (`fl_attachment`).

If a call fails, the page shows Cloudinary's message and does not swap in a fake image. If one of the two succeeds, you can still pick that one.

## Submission notes

- No API keys in the repo. `.env`, `.env.local`, `node_modules`, and `.next` are gitignored. `.env.example` has empty names only.
- Demo video: 2–4 minutes. Shot list is in [DEMO.md](DEMO.md).
- LinkedIn and X posts tagging HackIndia, Jen Looper, and Cloudinary.
- Survey: https://cld.media/hackathon-survey
- Form: https://forms.gle/GtukHAhcua6fviicA
- Freeze: 4 Oct 2026, 00:15 IST.
- Do not describe this project as already submitted.
