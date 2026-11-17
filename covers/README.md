# Per-article covers

Every pulse item gets its own cover artwork. It should read like a Headway book cover: one picture that tells this one story. Cover art is part of publishing an item. The editorial routine makes the cover in the same run as the text and commits both together.

## Where things go

| What | Value |
| --- | --- |
| Field | `coverImage` on the top-level `DailyPulseItem` (optional, not inside `i18n` or `levels`) |
| URL | `https://sapaude.app/covers/<item-id>.webp`, exactly this pattern. `<item-id>` is the item's `id`. |
| File in repo | `docs/covers/<item-id>.webp`. GitHub Pages serves `docs/` at `https://sapaude.app`. There is no root mirror: the app reads `https://sapaude.app/pulse.json` first, and the URL is absolute, so it also works when the app falls back to the raw GitHub copy of `pulse.json`. |
| Format | WebP, 600 x 800 px (3:4), quality about 82, under 120 KB (most are 15-45 KB) |
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

1. Read the whole article: hook, summary points and deep dive.
2. Write down ONE visual metaphor that tells this story in a single picture, and say it in one sentence before you generate anything. Good examples from Headway:
   - "Think Again": a hand squeezing a carrot until it drips.
   - "Grit": a figure pushing a giant gear up a mountain.
   - "Diary of a CEO": keys whose bows are a heart, a dollar sign, a house and a star.
   - Sapaude examples: model weights carry the GPU's fingerprint = a gym weight plate with a circuit-trace fingerprint pressed into it. Cheaper tasks = giant scissors cutting a coin stack in half. Keep chats but skip training = two switches, chat bubbles on the one that is on, a dumbbell unplugged from the one that is off.
3. Generate at 3:4 with the style references (`/workspace/sapaude-covers/refs/sample-chip.jpg`, `/workspace/sapaude-covers/refs/sample-law.jpg` on the box, or any cover already in `docs/covers/`). Prompt pattern:
   `Book-cover illustration, flat vector, Headway editorial style. Motif: <the metaphor, concretely>. The motif fills the entire cover edge to edge. Solid <colour + hex> background. Palette only: <3-5 brand hexes>. Big simple shapes, strong contrast, readable as a 100px thumbnail. Absolutely no text, no letters, no numbers, no logos, no hands, no orange.`
   Drop "no hands" only when a hand genuinely tells the story.
4. Check the result yourself (see the checklist below). Regenerate when it fails. Do not ship a weak one.
5. Convert and save:
   ```sh
   python3 -c "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').resize((600,800), Image.LANCZOS).save(sys.argv[2], 'WEBP', quality=82, method=6)" raw.png docs/covers/<item-id>.webp
   # or, if cwebp is installed:
   cwebp -q 82 -resize 600 800 raw.png -o docs/covers/<item-id>.webp
   ```
6. Add `coverImage` to the item in both feed files, run `node scripts/validate.mjs`, and commit the image together with the feed.

## Art direction

- Flat vector, bold simple shapes, no gradients beyond a soft glow, no photo realism.
- One solid, bold background colour. The motif is large and fills the whole 3:4 cover edge to edge; it may be cropped at the edges. No small object floating in empty space.
- Readable at about 100 px wide: one silhouette you recognise at a glance.
- Palette: brand blue `#3C9EC4`, navy `#0B2545`, deep green `#1F5C45`, petrol `#0E5E6F`, lime `#A8D63F`, cream `#F6EEDC`, warm yellow `#F5C842`, pink `#F2A7C3`. **No orange**, and no amber yellow that reads as orange.
- Vary the background colour: no two neighbouring items (by date) share one.
- **Never** text, letters, numbers, code characters, currency symbols, or labels, not even fake ones. The headline is rendered by the app, never on the cover.
- **Never** real company logos or product marks (no apple fruit for Apple, no G for Google), the mascot, or recognisable real people.
- Hands only where they tell the story, never as the default.
- Light and dark mode: the cover carries its own background, so it works on both.

## QC checklist (reject and regenerate when any answer is no)

- Does the picture tell this article's story, not just its topic? Could it belong to a different article? If yes, it is too generic.
- No letters, digits or glyph-like scribbles anywhere, including on papers, screens and signs?
- No logo, no real person, no mascot?
- No orange?
- Motif big, filling the cover, readable at 100 px?
- Background colour different from the neighbouring items?
