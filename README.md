# Sapaude

Content feed for [Sapaude](https://sapaude.app/), an Expo / React Native app for learning about AI. This repository holds the stories the app loads. The app code lives in the private app repo. The repository is [niklasgalli-oss/Sapaude-Content](https://github.com/niklasgalli-oss/Sapaude-Content).

The app fetches its feeds at runtime. The daily pulse the current app build requests is:

```
https://raw.githubusercontent.com/niklasgalli-oss/Sapaude-Content/main/pulse.json
```

The same file is published for the website, with no repository name in the address:

```
https://sapaude.app/pulse.json
```

`docs/pulse.json` is a byte-for-byte copy of the root file. GitHub Pages serves only `docs/`, so that copy is what `https://sapaude.app/pulse.json` returns. Keep the two files identical. `docs/CNAME` stays `sapaude.app`. Pages keeps the custom domain `sapaude.app`, branch `main`, folder `/docs`.

An AI news bot refreshes `pulse.json`. The published file keeps one timestamp per calendar day. The app shows one briefing package that day. Each entry is a `DailyPulseItem`. English is the primary language in the top-level fields. German copy lives under `i18n.de`.

## Legal

The privacy policy and the legal notice (Impressum) are static pages in `docs/`, published with GitHub Pages from the `main` branch folder `/docs`. `pulse.json` stays at the repository root, and `docs/pulse.json` mirrors it for `https://sapaude.app/pulse.json`.

- [Datenschutzerklärung](https://sapaude.app/privacy/) (German)
- [Privacy policy](https://sapaude.app/en/privacy/) (English)
- [Impressum / Legal notice](https://sapaude.app/impressum/)
- [Nutzungsbedingungen](https://sapaude.app/nutzungsbedingungen/) (German)
- [Terms of Use](https://sapaude.app/en/terms/) (English)
- [Support](https://sapaude.app/support/) (German)
- [Support](https://sapaude.app/en/support/) (English)

## Item shape

`pulse.json` is a JSON array. The contract is `schema/pulse.schema.json`. `scripts/validate.mjs` checks the file on every push and pull request (see `.github/workflows/validate-pulse.yml`).

Each item has:

| Field | Rule |
| --- | --- |
| `id` | `pulse-YYYY-MM-DD-short-slug`. URL-safe, stable, unique. The date prefix is the UTC calendar date of `date`. Never reuse an id, including after the item rolls off. |
| `date` | ISO-8601 UTC timestamp with milliseconds, for example `2026-10-04T15:00:00.000Z`. Must not be in the future. |
| `tag` | One of `Model Release`, `Framework`, `Autonomous Agent`, `Benchmarks`, `Hardware`, `Tools`. Use `Tools` for consumer and everyday products people can try today (ChatGPT features, free tiers, mobile apps, SDKs end users install). Research papers and infrastructure alone are not `Tools`. |
| `priority` | Optional. `breaking` marks major model or product launches the app may pin at the top. Omit it, or use `normal`, for routine daily items. |
| `readTimeMinutes`, `listenTimeMinutes` | Positive whole minutes, from 1 to 30. Both clocks use minutes for the same item. |
| `hook` | One sentence under the title. |
| `headline` | 2-5 words, at most 32 characters, in English and in `i18n.de` alike. Aim for 27 or fewer: 28-32 characters is a warning, and longer than 32 is an error. The title must state what changes or what the reader can now do (e.g. `ChatGPT answers visually now`), never just `<product> in <product>` or a bare product name. Sentence case, unless the whole headline is title case. Details belong in `hook` or `summaryPoints`, not in the title. `briefing.json` headlines are unaffected and stay at most 60 characters. |
| `shortTitle` | Optional for older items. About 3-5 words, in English and in `i18n.de`, that still say what changes, not a bare product name. The validator warns when it is missing or longer than 24 characters. |
| `summaryPoints` | Exactly three strings: what the source shows, the limit of that claim, and what to check next. |
| `takeaway` | Optional. Up to three concrete to-dos grounded in the item's source, for example `Test Y in the new model X, because it can now do Z`. Omit the field, or use an empty string, when there is no sensible to-do. The app hides the section in that case. |
| `deepDiveMarkdown` | Exactly four `## ` sections, in this order of roles: entry, how it works, the catch, what to do. Each heading is a specific statement about this story, at most 9 words, never ending with a period, and never a template label such as `The Hook` or `Practical Takeaway`. The validator checks the section count, word count and trailing period. Aim for about 150–260 words in each section. |
| `source` | Exactly one `{ "name", "url" }`. `name` is the publisher. `url` is one well-formed `https` URL. Do not reuse a URL on another item. |
| `i18n.de` | German `headline` (same 2-5 words, max 32 characters), `shortTitle`, `hook`, `summaryPoints`, `takeaway`, and `deepDiveMarkdown`, with the same structure as English. `takeaway` and `shortTitle` may be omitted. Technical AI terms stay in English and are capitalised as German nouns. Write ä, ö, ü, and ß. The validator warns on common umlaut-less spellings such as `fur`, `ueber`, `Arzte`, `schlagt`, and `ss` where German uses `ß`. |
| `levels` | Optional. Root fields stay the intermediate text. `beginner` and `advanced` are each optional; a variant requires `headline`, `hook`, `summaryPoints`, `deepDiveMarkdown`, and `de` with the same required fields. `takeaway` and `shortTitle` may be omitted on the variant and on `de`. Omit a whole variant rather than leaving fields empty. Never copy root text. Headlines, short titles, and deep dives follow the same rules as the root. |

Run the check locally:

```bash
node scripts/validate.mjs
node scripts/validate-briefing.mjs
node --test scripts/validate.test.mjs scripts/validate-briefing.test.mjs
node scripts/validate.mjs --check-urls
```

`--check-urls` requests each source URL and requires HTTP 200. It is off by default, including on push and pull request, because a publisher can block an automated client. Run the GitHub Actions workflow manually with the `check_urls` input when you want that check in CI.

Errors fail the process. Warnings do not. A capitalised glossary term in the English card fields, a reused id, a reused source URL, a malformed briefing `pulseId`, and a pulse headline longer than 32 characters are errors. A missing beginner sentence is a warning. A pulse headline of 28-32 characters is a warning too. A missing `shortTitle`, or one longer than 24 characters, is a warning. A common umlaut-less spelling in a German field is a warning. A briefing `pulseId` that matches `pulse-YYYY-MM-DD-short-slug` but is not in the current `pulse.json` is a warning, and the check still exits 0. The app hides the deep-dive link in that case. `briefing.json` headlines stay at most 60 characters and do not use the pulse length warning.

## Editorial checklist

Tick these 15 points before you add an item.

1. **Sourcing.** One real publication per item. `source.name` is the publisher, `source.url` is that publication's `https` URL, and `date` is the publication time. The URL has to be well-formed. Use `--check-urls` when you want an HTTP 200 check.
2. **Numbers with a retrieval time.** Every figure says who measured it and the date of the source, which is the day a reader would retrieve it. Do not float a percentage with no owner and no date.
3. **Attribution versus claims.** Keep what the source says separate from what you conclude. A vendor score stays a vendor score. `summaryPoints[1]` is the limit of the claim.
4. **No glossary capitalisation.** In English, agent, token, reasoning, inference, benchmark, context window, open weights, and fine-tuning are lowercase common nouns. Capitalise one only when it starts a sentence, the headline is title case, it is part of a product name, or it sits inside a title-cased proper name of two or more consecutive capitalised words (for example `Personal Agent Protocol` or `Critical Infrastructure Defense Program`). A leading `The`, `A`, or `An` does not make a lone glossary word into a proper name, so `The Agent ships` is still an error. The validator errors on the English `headline`, `hook`, `summaryPoints`, and `takeaway`. Use the same rule in `deepDiveMarkdown`. Product names that contain a glossary word are allowlisted in `scripts/validate.mjs`: Open Agent Safety Platform, Microsoft Agent 365, Claude Managed Agents, Agent Toolkit, and 1Password for Agents.
5. **Freshness.** `date` is not in the future. Keep at most 12 items and drop the oldest from the front. That is how stale content is removed. There is no separate stale flag.
6. **One subject per item.** One launch, one mechanism, one decision. A second product gets its own item.
7. **Beginner first sentence.** `hook` or `summaryPoints[0]` says what the thing is, in plain language, before the news. The validator warns when it cannot see that sentence. The warning does not fail the check.
8. **Concrete to-dos.** `takeaway` holds at most three tasks the reader can actually do, each grounded in the source. Omit it, or leave it empty, when there is no sensible to-do. Do not restate the news.
9. **Consistent duration.** `readTimeMinutes` and `listenTimeMinutes` are positive whole minutes for this item. Do not mix seconds, ranges, or a different length in the prose.
10. **No duplicate sources.** A `source.url` is used once. Do not publish the same URL again under a new headline. That is an error. A trailing slash or a different host capitalisation still counts as the same URL.
11. **Ids are never reused.** An `id` appears once in the file and never comes back after the item rolls off. A duplicate id is an error.
12. **German keeps technical terms in English.** `i18n.de` is German prose, not a sentence-by-sentence translation. Do not translate agent, token, reasoning, inference, benchmark, context window, open weights, or fine-tuning. Leave the English word in the German sentence.
13. **Human-style spot check.** Read the headline, hook, three summary points, and takeaway aloud. They should sound like a person explaining the story to a newcomer, including the deep dive.
14. **Priority and Tools.** Set `priority` to `breaking` only for a major model or product launch the app may pin. Omit `priority`, or use `normal`, for a routine daily item. Use the `Tools` tag for a consumer product people can try today, such as a ChatGPT feature, a free tier, a mobile app, or an SDK end users install. A research paper or infrastructure alone is not `Tools`.
15. **Short titles.** The pulse `headline`, in English and in German, is 2-5 words and at most 32 characters. Aim for 27 or fewer. A headline of 28-32 characters prints a warning and still passes; 33 or more is an error. The title must state what changes or what the reader can now do (e.g. `ChatGPT answers visually now`), never just `<product> in <product>` or a bare product name. Details belong in `hook` or `summaryPoints`, not in the title. Good titles: `Gemini free plan downgrades`, `Startups get Claude free`, `AI that runs your computer`, `Cheaper AI images in Gemini`, `ChatGPT text gets a watermark`, `Spot AI fakes yourself`, `Turn a prompt into a game`, `Free AI search on your phone`, `Claude edits your Google Docs`, `ChatGPT answers visually now`, `Claude Haiku gets far cheaper`, `ChatGPT takes meeting notes`, `Gratis-Gemini wird schwächer`, `Claude gratis für Start-ups`, `KI bedient deinen Computer`, `KI-Bilder für den halben Preis`, `ChatGPT-Texte mit Wasserzeichen`, `KI-Fakes selbst erkennen`, `Spiele per Prompt bauen`, `Gratis KI-Suche auf dem Handy`, `Claude bearbeitet Google Docs`, `ChatGPT antwortet jetzt visuell`, `Claude Haiku wird viel billiger`, `ChatGPT schreibt Meeting-Notizen`. Headlines in `briefing.json` are unaffected and stay at most 60 characters.

## Rolling list of 12

Keep at most 12 items.

- Append a new item at the end of the array.
- When the list would pass 12, drop the oldest items from the front until 12 remain.
- Never reuse an `id`, including ids that have already rolled off the list.
- Never reuse a `source.url`, including on a new headline.

## German copy

Write `i18n.de` in German. The German `headline` follows the same length rule as English: 2-5 words, at most 32 characters, aim for 27 or fewer. Keep the glossary terms in English inside that German text. German capitalises nouns, so the English term stays capitalised there (`Agent`, `Token`, `Benchmark`, `Context Window`). That capitalisation is correct in German and the validator does not flag it.

In English fields the same words are ordinary lowercase nouns (`agent`, `token`, `benchmark`, `context window`), except as product names, at the start of a sentence, in a title-cased headline, or inside a title-cased proper name of two or more consecutive capitalised words.

## Daily briefing (briefing.json)

The app also fetches a short daily briefing. The current app build requests:

```
https://raw.githubusercontent.com/niklasgalli-oss/Sapaude-Content/main/briefing.json
```

The website publishes the same file at `https://sapaude.app/briefing.json` (`docs/briefing.json`, kept identical to the root file). The product page loads that address.

`briefing.json` is one JSON object (`schemaVersion`, `updatedAt`, `days`). The contract is `schema/briefing.schema.json`. `scripts/validate-briefing.mjs` checks it on every push and pull request, in the same workflow as the pulse feed. The check stays offline.

`updatedAt` is an ISO-8601 date-time with a numeric offset, for example `2026-10-08T04:45:00+02:00`. `days` holds 1 to 7 objects, newest first. Each day has a Europe/Berlin calendar `date` (`YYYY-MM-DD`) and 6 to 8 items.

| Field | Rule |
| --- | --- |
| `id` | `YYYY-MM-DD-short-slug`. Unique across the file. The date prefix equals that day's `date`. |
| `headline` | 1 to 60 characters, sentence case. Unaffected by the 32-character pulse headline limit. |
| `summary` | 1 to 240 characters, one or two sentences. |
| `source` | Exactly `{ "name", "url" }`. `url` is `https`, with the same pattern as the pulse feed. |
| `tag` | The pulse tag list: `Model Release`, `Framework`, `Autonomous Agent`, `Benchmarks`, `Hardware`, `Tools`. The briefing schema references that enum. |
| `priority` | Optional. `normal` or `breaking`, with the same meaning as in `pulse.json`. |
| `pulseId` | Optional. Must match `pulse-YYYY-MM-DD-short-slug`. A well-formed id that is not in the current `pulse.json` is a warning and the validator exits 0; the app hides the deep-dive link. A malformed id is an error. |
| `level` | Optional. `beginner` or `advanced`. Missing means beginner-friendly. Use `advanced` only for real jargon. |
| `i18n.de` | German `headline` (1–60) and `summary` (1–240). Technical AI terms stay in English: LLM, agent, token, RAG, prompt, context window, benchmark, reasoning, open weights, fine-tuning, inference. |

Rolling window: keep at most 7 days, newest first. When you add a new day and the list would pass 7, drop the oldest day.

In the English `headline` and `summary`, agent, token, reasoning, inference, benchmark, context window, open weights, and fine-tuning stay lowercase common nouns, same as the pulse feed. A capitalised glossary term is an error, except inside a title-cased proper name. German copy may capitalise those English terms.
