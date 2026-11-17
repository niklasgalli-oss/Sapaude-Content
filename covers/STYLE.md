# Sapaude Cover-Stil v7-A (Headway-Klassik)

Gilt für **jedes neue Pulse-/Briefing-Cover** (News-Redaktion-Routine) und für die Ersatz-Motive.

## Prinzip
- **Ein** großes Objekt mit **einer Pointe** zur konkreten Story (nicht das Themen-Icon). Beispiel: „Qwen senkt Kosten“ → Hackbeil zerteilt ein Preisschild.
- 2–4 große Formen, gern vom Rand angeschnitten. Wenige Details, gut lesbar bei 110×145 px.
- Flach-Vektor: Vollflächen, keine Verläufe, Texturen, Glanz, Schatten oder Körnung. Gestochen scharfe Kanten.
- **3 Farben + Fast-Schwarz (#141414)**, eigene kräftige Palette pro Cover.
- Hintergrund **einfarbig, ohne Bänder**. Oberes Drittel ruhig, Motiv in den unteren zwei Dritteln.
- **Verboten:** Text, Buchstaben, Ziffern, Logos, echte Personen, Sapi-Maskottchen, Orange. Hände nur, wenn unverzichtbar.

## Paletten-Bank (Hintergrund / Akzente, + #141414)
| ID | Hintergrund | Akzente |
|---|---|---|
| P0 | Violett #3B1F6B | Lime #B6E43C, Creme #F3EAD7 |
| P1 | Zitrone #F4D63B | Blau #3C9EC4, Weiß |
| P2 | Navy #13224F | Magenta #E2367A, Creme |
| P3 | Smaragd #0F4D3A | Pink #F28DB2, Weiß |
| P4 | Markenblau #3C9EC4 | Creme, Karmin #D7263D |
| P5 | Creme #F3EAD7 | Karmin, Navy |
| P6 | Pink #F28DB2 | Violett, Lime |
| P7 | Petrol #1F6F6B | Gelb, Creme |
| P8 | Fast-Schwarz | Lime, Weiß, Grau #8A8F98 |
| P9 | Karmin #C8243A | Creme, Navy |
| P10 | Himmel #A9D8EA | Navy, Magenta |
| P11 | Flieder #B9A6E8 | Smaragd, Weiß |

**Nachbarregel:** Neue Cover dürfen keine Palette (auch keine ähnliche Hintergrundfarbe) mit den 2 vorherigen Covers in pulse.json teilen. Pragmatisch: die Paletten von Platz 1–3 ansehen und eine andere nehmen.

## Prompt-Vorlage (GenerateImage, 3:4; als Referenzen die Bilder in `v7-A/refs/` mitgeben)
```
Flat vector book-cover illustration in the exact style of the reference images (Headway book summary covers):
ONE single bold idea with a witty punchline, huge simple shapes cropped by the frame edges, solid flat colour
fields, no gradients, no texture, no shadows, crisp razor-sharp edges, 3 colours plus near-black #141414.
The background is ONE uniform colour everywhere, no bands; generous empty space above, motif in the lower two thirds.
Scene: <EIN Objekt + Pointe zur Story, 1–2 Sätze>.
Background <Farbe + Hex>. Palette: <Akzente + Hex> and near-black.
Absolutely no text, letters, numbers, logos, zero writing; no people, no faces. No orange. Portrait 3:4.
```
Hinweis: „top 35% calm background“ erzeugt zweifarbige Bänder, deshalb immer „ONE uniform colour everywhere, no bands“ schreiben.

## Ablauf
1. Story in einem Satz → 2–3 Pointen-Ideen → beste wählen.
2. **2–4 Kandidaten** generieren (GenerateImage mit Referenzen + 1× Canva generate-image, PORTRAIT_3_4, gleicher Prompt ohne Referenzen; Canva-PNG per Resource-URL laden), besten nach QC wählen.
3. Auf 600×800 skalieren/zuschneiden, WebP q≈86, **< 120 KB** (Motive: q82, < 60 KB).
4. Ablage `Sapaude-Content/docs/covers/<pulse-id>.webp`, `coverImage` in pulse.json setzen.
5. **Kein Push/Commit ohne Freigabe von Niklas.**

## QC-Checkliste (jeder Punkt muss passen)
- [ ] Keine Buchstaben/Ziffern/Pseudo-Schrift, keine Logos, keine Gesichter/Personen, kein Orange, kein Sapi
- [ ] Hintergrund einfarbig, keine Bänder (bei Band: Band mit Hintergrundfarbe füllen oder neu generieren)
- [ ] Keine Verläufe, kein Glanz, keine Texturen
- [ ] Pointe in 2 Sekunden lesbar, auch bei 110×145 (Thumbnail-Test)
- [ ] Max. 3 Farben + Schwarz; Palette anders als die Nachbarn
- [ ] 600×800, WebP, < 120 KB
