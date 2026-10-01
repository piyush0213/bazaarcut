# BazaarCut demo video (about 3 minutes)

Record a phone-width browser window. English. No chatbot, no extra tabs full of keys.

## Before you record

- App is running (`npm run dev`).
- Either leave env vars empty (sample path only) or set them and confirm one sample upload works.
- If you will show live generation, subscribe to the Image Generation add-on first and have credits left. The button spends two generations. Do that take once.

## Shot list

### 0:00–0:20 — Name the problem

On screen: the BazaarCut header and the five samples (brass diya, cotton kurta, clay mug, spice jar, jute bag).

Say: "BazaarCut is for Meesho and Instagram resellers who only have one flat-lay. Track 2, PS-02: generative content workflows, with model choice inside the pipeline. It is not submitted yet."

### 0:20–1:00 — Photo in, no credits

On screen: tap **Brass diya**. Wait for the original card and the three delivery cards.

Say: "This path does not call image generation. The original photo is the asset. Catalog is background removal plus drop shadow. Square is a 1:1 content-aware crop. Story is 9:16. All three use f_auto, q_auto."

Point at the URL text so `e_background_removal`, `e_dropshadow`, and `c_auto,g_auto` are readable. If the banner says the demo cloud is in use, say that out loud. Do not pretend the guitar is the diya.

### 1:00–1:25 — The two-generation cap

On screen: the "Two generations" card, including the sentence that the button runs quality_fast and economy_fast and spends credits.

Say: "Live generation is two image-to-image calls. Mode auto. One preference is quality_fast, the other is economy_fast. The API secret stays on the server. Free credits are limited, and the hackathon page does not mention the add-on."

If env vars are missing, stop the live part here. Say generation is wired but will not run until the add-on and env vars are set. Skip to the close.

### 1:25–2:30 — Both model ids

On screen: click **Generate two versions**. Wait. Both cards must be visible at once.

Say: "Cloudinary picked the model. The id on each card is data.assets model id, not a name I hardcoded."

Read both model ids aloud. If one card errors, read the error and pick the one that returned an id. Do not hide the failure.

### 2:30–3:10 — Pick one, deliver three

On screen: click **Use this one** on one generated card. The outline moves. Scroll so the public id line and all three crops are in frame.

Say: "Only this public id is delivered. The other generation is not in these URLs."

Open the catalog URL, then the story URL, or show Download. The public id in the address bar must match the picked card.

### 3:10–3:30 — Close

On screen: the footer (PS-02, not submitted).

Say: "Samples work without burning generation credits. The video for submission is this flow: upload or sample, both model ids, pick, three crops."

## Must be on screen

- The source photo (upload control or a sample)
- Both model ids, if you run generation
- The pick action
- Catalog, square, and story, with the transform URL visible
