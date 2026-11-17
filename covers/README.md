# Per-article covers

Every pulse item gets its own cover artwork. It should read like a Headway book cover: one picture that tells this one story. Cover art is part of publishing an item. The editorial routine makes the cover in the same run as the text and commits both together.

**Binding style:** [`STYLE.md`](./STYLE.md) — v7-A, direction A, Headway-Klassik. Follow that file for principle, palettes, prompt, workflow and QC. This README only describes where files live and how they get into the feed.

## Where things go

| What | Value |
| --- | --- |
| Field | `coverImage` on the top-level `DailyPulseItem` (optional, not inside `i18n` or `levels`) |
| URL | `https://sapaude.app/covers/<item-id>.webp`, exactly this pattern. `<item-id>` is the item's `id`. Query strings are not allowed (`scripts/validate.mjs` requires an exact match). |
| File in repo | `docs/covers/<item-id>.webp`. GitHub Pages serves `docs/` at `https://sapaude.app`. There is no root mirror: the app reads `https://sapaude.app/pulse.json` first, and the URL is absolute, so it also works when the app falls back to the raw GitHub copy of `pulse.json`. |
| Format | WebP, 600 x 800 px (3:4), quality about 86, under 120 KB |
| Feed files | Set the field in `pulse.json` and in `docs/pulse.json`. The two files stay byte-identical. |

Example:

```json
{
  "id": "pulse-2026-11-14-gpu-fingerprints-in-weights",
  "coverImage": "https://sapaude.app/covers/pulse-2026-11-14-gpu-fingerprints-in-weights.webp",
  ...
}
```

`node scripts/validate.mjs` fails when `coverImage` is on another host, does not match the item id, or when the file is missing, is not WebP, or is 120 KB or larger. Items without `coverImage` still pass, and the app falls back to its theme covers for them. When an item rolls off the feed, leave its file in place. Ids are never reused, so the file does no harm.

## Workflow per item

Follow the Ablauf and QC checklist in [`STYLE.md`](./STYLE.md). In short:

1. Read the whole article: hook, summary points and deep dive.
2. Write down ONE visual metaphor with a punchline that tells this story in a single picture, and say it in one sentence before you generate anything. This is the story, not the topic icon. Examples are in `STYLE.md`.
3. Generate 2–4 candidates at 3:4 with the prompt and palettes in `STYLE.md` (GenerateImage plus references, and one Canva generate-image). Pick the best after QC.
4. Check the result against the `STYLE.md` checklist. Regenerate when it fails. Do not ship a weak one.
5. Convert and save:

   ```sh
   python3 -c "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').resize((600,800), Image.LANCZOS).save(sys.argv[2], 'WEBP', quality=86, method=6)" raw.png docs/covers/<item-id>.webp
   # or, if cwebp is installed:
   cwebp -q 86 -resize 600 800 raw.png -o docs/covers/<item-id>.webp
   ```

   Keep the file under 120 KB. Fallback motifs in the app use quality about 82 and stay under 60 KB.

6. Add `coverImage` to the item in both feed files, run `node scripts/validate.mjs`, and commit the image together with the feed. Do not push without Niklas's approval.

## Art direction

See [`STYLE.md`](./STYLE.md). The binding rules are: one large object with a punchline; 3 colours plus near-black `#141414` and a unique palette per cover from the palette bank; a uniform background with no bands; flat vector, no gradients, texture, gloss or grain; no text, letters, numbers, logos, real people, Sapi, or orange. Hands only when the idea needs them. Neighbours in `pulse.json` must not share a palette.
