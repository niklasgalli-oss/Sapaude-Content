import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalSourceUrl,
  collectSchemaErrors,
  explainsSubject,
  glossaryViolations,
  httpsUrlError,
  lintFeed,
  lowercaseGlossaryTerms,
  shortTitleProblem,
  obsoleteEszettSpellings,
  umlautLessSpellings,
  usesHeadlineCasing,
} from "./validate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pulse = JSON.parse(readFileSync(join(root, "pulse.json"), "utf8"));
const schema = JSON.parse(readFileSync(join(root, "schema", "pulse.schema.json"), "utf8"));

function deepDive(body = "A short section.") {
  return [
    "## The Hook",
    "",
    body,
    "",
    "## The Core Mechanism",
    "",
    body,
    "",
    "## The Trade-off",
    "",
    body,
    "",
    "## Practical Takeaway",
    "",
    body,
    "",
  ].join("\n");
}

function copy(overrides = {}) {
  return {
    headline: "Beispiel prüft den Feed",
    hook: "Beispiel ist ein Werkzeug für den Feed.",
    summaryPoints: ["Eins ist die Quelle.", "Zwei nennt die Grenze.", "Drei sagt den nächsten Schritt."],
    shortTitle: "Beispiel prüft den Feed",
    takeaway: "Starte den Check vor dem Push.",
    deepDiveMarkdown: deepDive("Kurzer Abschnitt mit dem Agent und einem Token."),
    ...overrides,
  };
}

function item(overrides = {}) {
  const base = {
    id: "pulse-2026-10-01-example",
    date: "2026-10-01T00:00:00.000Z",
    tag: "Framework",
    readTimeMinutes: 4,
    listenTimeMinutes: 6,
    hook: "Example is a tool that checks a story before it ships.",
    headline: "Example checks the feed",
    shortTitle: "Example checks the feed",
    summaryPoints: [
      "Example is a validator for the pulse feed.",
      "It does not fetch the network unless asked.",
      "Run it before you push.",
    ],
    takeaway: "Run the validator before you push.",
    deepDiveMarkdown: deepDive(),
    source: { name: "Example News", url: "https://example.com/story" },
    i18n: { de: copy() },
  };
  return {
    ...base,
    ...overrides,
    source: { ...base.source, ...overrides.source },
    i18n: overrides.i18n ?? base.i18n,
  };
}

const NOW = Date.parse("2026-10-04T12:00:00.000Z");

test("schema still matches the validator contract", () => {
  assert.deepEqual(collectSchemaErrors(schema), []);
  assert.equal(schema.$defs.dailyPulseItem.required.includes("priority"), false);
  assert.equal(schema.$defs.dailyPulseItem.required.includes("levels"), false);
  assert.equal(schema.$defs.dailyPulseItem.required.includes("takeaway"), false);
  assert.equal(schema.$defs.dailyPulseItem.required.includes("shortTitle"), false);
  assert.equal(schema.$defs.localizedCopy.required.includes("takeaway"), false);
  assert.equal(schema.$defs.levelVariant.required.includes("takeaway"), false);
  assert.equal(schema.$defs.dailyPulseItem.additionalProperties, false);
  assert.equal(schema.$defs.dailyPulseItem.properties.levels.additionalProperties, false);
  assert.equal(schema.$defs.levelVariant.additionalProperties, false);
});

test("Tools tag is accepted and priority stays optional", async () => {
  const omitted = await lintFeed([item({ tag: "Tools" })], { now: NOW });
  assert.deepEqual(omitted.errors, []);
  assert.equal(Object.hasOwn(item({ tag: "Tools" }), "priority"), false);

  for (const priority of ["normal", "breaking"]) {
    const result = await lintFeed([item({ tag: "Tools", priority })], { now: NOW });
    assert.deepEqual(result.errors, [], priority);
  }

  const routine = await lintFeed([item()], { now: NOW });
  assert.deepEqual(routine.errors, []);

  for (const priority of ["urgent", "", null, 1]) {
    const result = await lintFeed([item({ priority })], { now: NOW });
    assert.match(result.errors.join("\n"), /priority/, String(priority));
  }
});

test("live source URLs are https and match the schema pattern", () => {
  const pattern = new RegExp(schema.$defs.dailyPulseItem.properties.source.properties.url.pattern);
  for (const entry of pulse) {
    assert.equal(httpsUrlError(entry.source.url), null, entry.source.url);
    assert.match(entry.source.url, pattern);
  }
});

test("flags glossary terms capitalised mid-sentence", () => {
  const headline = glossaryViolations("Claude Code mods let you reprogram the Agent loop", { headline: true });
  assert.deepEqual(headline.map((hit) => hit.term), ["Agent"]);
  assert.equal(headline[0].expected, "agent");

  const weights = glossaryViolations("Aleph Alpha ships Kolibri as German Open Weights", { headline: true });
  assert.deepEqual(weights.map((hit) => hit.term), ["Open Weights"]);
  assert.equal(weights[0].expected, "open weights");

  const price = glossaryViolations("Sol cut the Token price and the Reasoning effort.");
  assert.deepEqual(price.map((hit) => [hit.term, hit.expected]), [
    ["Token", "token"],
    ["Reasoning", "reasoning"],
  ]);

  assert.equal(glossaryViolations("The lab skipped FINE-TUNING on this run.")[0].expected, "fine-tuning");
  assert.equal(glossaryViolations("Raise the Context window before you retry.")[0].expected, "context window");
});

test("allows sentence starts, title case, and product names", () => {
  assert.deepEqual(glossaryViolations("Tokens got cheaper. Agents kept the log."), []);
  assert.deepEqual(glossaryViolations("Context window size is the first limit."), []);
  assert.equal(usesHeadlineCasing("How Agents Spend Tokens During Inference"), true);
  assert.deepEqual(
    glossaryViolations("How Agents Spend Tokens During Inference", { headline: true }),
    [],
  );
  assert.equal(usesHeadlineCasing("Claude Code mods let you reprogram the Agent loop"), false);
  for (const name of [
    "Open Agent Safety Platform",
    "Microsoft Agent 365",
    "Claude Managed Agents",
    "Agent Toolkit",
    "1Password for Agents",
  ]) {
    assert.deepEqual(glossaryViolations(`The release pairs ${name} with a local runtime.`), [], name);
  }
});

test("lowercaseGlossaryTerms keeps product names and sentence starts", () => {
  const input = "Agents, Inference, Fine-Tuning, and a Token. The Open Agent Safety Platform stays. A Benchmark too.";
  const output = lowercaseGlossaryTerms(input);
  assert.match(output, /^Agents, inference, fine-tuning, and a token\./);
  assert.match(output, /Open Agent Safety Platform/);
  assert.match(output, /A benchmark too\./);
});

test("skips glossary words inside title-cased proper names", () => {
  assert.deepEqual(glossaryViolations("Sierra published the Personal Agent Protocol on Friday."), []);
  assert.deepEqual(
    glossaryViolations("Anthropic's Critical Infrastructure Defense Program pairs models with partners."),
    [],
  );
  assert.deepEqual(glossaryViolations("the Agent Protocol ships next week."), []);
  assert.deepEqual(glossaryViolations("The Agent ships in this headline today.").map((hit) => hit.term), ["Agent"]);
  assert.deepEqual(
    glossaryViolations("Aleph Alpha ships Kolibri as German Open Weights").map((hit) => hit.term),
    ["Open Weights"],
  );

  const output = lowercaseGlossaryTerms(
    "Sierra published the Personal Agent Protocol, then cut the Token price.",
  );
  assert.match(output, /Personal Agent Protocol/);
  assert.match(output, /the token price/);
});

test("beginner sentence is a warning, not an error", async () => {
  assert.equal(explainsSubject("Dots are named, always-on agents."), true);
  assert.equal(explainsSubject("Kolibri, a 78B English-German model, shipped."), true);
  assert.equal(explainsSubject("Claude Code now runs mods, small functions that rewrite prompts."), true);
  assert.equal(explainsSubject("OpenAI shipped Sol at a lower price."), false);

  const defined = await lintFeed([item()], { now: NOW });
  assert.deepEqual(defined.errors, []);
  assert.deepEqual(defined.warnings, []);

  const vague = await lintFeed(
    [
      item({
        hook: "OpenAI shipped Sol at a lower price after internal tests.",
        summaryPoints: [
          "OpenAI says Sol approaches Astra on coding and computer use.",
          "Those figures are the company's own comparisons.",
          "Compare one real task before you trust the price.",
        ],
      }),
    ],
    { now: NOW },
  );
  assert.deepEqual(vague.errors, []);
  assert.equal(vague.warnings.length, 1);
  assert.match(vague.warnings[0], /beginner sentence/);
});

test("duplicate ids and source URLs are errors", async () => {
  const first = item({ id: "pulse-2026-10-01-one", source: { url: "https://example.com/same/" } });
  const second = item({
    id: "pulse-2026-10-01-two",
    headline: "Same source, new headline",
    source: { url: "https://EXAMPLE.com/same" },
  });
  const result = await lintFeed([first, second], { now: NOW });
  assert.match(result.errors.join("\n"), /duplicate of pulse-2026-10-01-one/);
  assert.equal(canonicalSourceUrl("https://EXAMPLE.com/same/"), canonicalSourceUrl("https://example.com/same"));

  const reusedId = await lintFeed(
    [item({ id: "pulse-2026-10-01-one" }), item({ id: "pulse-2026-10-01-one", source: { url: "https://example.com/other" } })],
    { now: NOW },
  );
  assert.match(reusedId.errors.join("\n"), /duplicate id pulse-2026-10-01-one/);
});

test("future dates, bad durations, and malformed URLs are errors", async () => {
  const future = await lintFeed(
    [item({ date: "2026-10-05T00:00:00.000Z", id: "pulse-2026-10-05-later" })],
    { now: NOW },
  );
  assert.match(future.errors.join("\n"), /must not be in the future/);

  for (const readTimeMinutes of [0, -1, 1.5, 31, "4"]) {
    const result = await lintFeed([item({ readTimeMinutes })], { now: NOW });
    assert.match(result.errors.join("\n"), /positive whole number of minutes/, String(readTimeMinutes));
  }

  assert.equal(httpsUrlError("https://example.com/a"), null);
  assert.match(httpsUrlError("http://example.com/a"), /https/);
  assert.match(httpsUrlError("https://"), /well-formed/);
  assert.match(httpsUrlError("https://localhost/a"), /host name/);
  assert.match(httpsUrlError("https://user:pass@example.com/a"), /credentials/);

  const badUrl = await lintFeed([item({ source: { url: "http://example.com/a" } })], { now: NOW });
  assert.match(badUrl.errors.join("\n"), /https/);
});

test("German capitalised glossary terms are not errors", async () => {
  const result = await lintFeed(
    [
      item({
        i18n: {
          de: copy({
            hook: "Der Agent bleibt im Token-Preis und im Benchmark stehen.",
            takeaway: "Prüfe den Context Window und das Fine-Tuning.",
          }),
        },
      }),
    ],
    { now: NOW },
  );
  assert.deepEqual(result.errors, []);
});

test("--check-urls requires HTTP 200 and can be injected", async () => {
  const ok = await lintFeed([item()], { now: NOW, checkUrls: true, fetchUrl: async () => 200 });
  assert.deepEqual(ok.errors, []);

  const missing = await lintFeed([item()], { now: NOW, checkUrls: true, fetchUrl: async () => 404 });
  assert.match(missing.errors.join("\n"), /expected HTTP 200, got HTTP 404/);

  const skipped = await lintFeed([item()], { now: NOW, checkUrls: false, fetchUrl: async () => 500 });
  assert.deepEqual(skipped.errors, []);
});

test("headlines of 33 characters fail, 30 warn, and 20 pass quietly", async () => {
  const text = (length) => "A".repeat(length);

  const longEn = await lintFeed([item({ headline: text(33) })], { now: NOW });
  assert.match(longEn.errors.join("\n"), /\[0\]\.headline: must be <= 32 characters \(is 33\)/);
  assert.equal(longEn.warnings.some((warning) => warning.includes("characters")), false);

  const longDe = await lintFeed(
    [item({ i18n: { de: copy({ headline: text(33) }) } })],
    { now: NOW },
  );
  assert.match(longDe.errors.join("\n"), /i18n\.de\.headline: must be <= 32 characters \(is 33\)/);
  assert.equal(longDe.warnings.some((warning) => warning.includes("characters")), false);

  const warnEn = await lintFeed([item({ headline: text(30) })], { now: NOW });
  assert.deepEqual(warnEn.errors, []);
  assert.deepEqual(warnEn.warnings, [
    "pulse.json[0].headline: is 30 characters; aim for 27 or fewer",
  ]);

  const warnDe = await lintFeed(
    [item({ i18n: { de: copy({ headline: text(30) }) } })],
    { now: NOW },
  );
  assert.deepEqual(warnDe.errors, []);
  assert.deepEqual(warnDe.warnings, [
    "pulse.json[0].i18n.de.headline: is 30 characters; aim for 27 or fewer",
  ]);

  for (const length of [28, 32]) {
    const edge = await lintFeed([item({ headline: text(length) })], { now: NOW });
    assert.deepEqual(edge.errors, [], String(length));
    assert.match(edge.warnings.join("\n"), new RegExp(`is ${length} characters`));
  }

  const under = await lintFeed([item({ headline: text(27) })], { now: NOW });
  assert.deepEqual(under.errors, []);
  assert.deepEqual(under.warnings, []);

  const quiet = await lintFeed(
    [item({ headline: text(20), i18n: { de: copy({ headline: text(20) }) } })],
    { now: NOW },
  );
  assert.deepEqual(quiet.errors, []);
  assert.deepEqual(quiet.warnings, []);
});

test("live pulse.json passes", async () => {
  const result = await lintFeed(pulse, { now: Date.now() });
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.some((warning) => warning.includes("umlaut-less")), false);
  assert.equal(result.warnings.some((warning) => warning.includes("obsolete spelling")), false);
  assert.equal(result.warnings.some((warning) => warning.includes("shortTitle")), false);
});

test("takeaway may be omitted or empty", async () => {
  const omitted = item();
  delete omitted.takeaway;
  delete omitted.i18n.de.takeaway;
  const gone = await lintFeed([omitted], { now: NOW });
  assert.deepEqual(gone.errors, []);

  const empty = await lintFeed(
    [item({ takeaway: "", i18n: { de: copy({ takeaway: "" }) } })],
    { now: NOW },
  );
  assert.deepEqual(empty.errors, []);

  const variant = levelVariant("Beginner");
  delete variant.takeaway;
  delete variant.de.takeaway;
  const level = await lintFeed([item({ levels: { beginner: variant } })], { now: NOW });
  assert.deepEqual(level.errors, []);

  const bad = await lintFeed([item({ takeaway: 3 })], { now: NOW });
  assert.match(bad.errors.join("\n"), /takeaway: must be a string/);
});

test("shortTitle warns when missing or longer than 24 characters", async () => {
  assert.equal(shortTitleProblem(undefined), "missing; use about 3-5 words that say what changes");
  assert.equal(shortTitleProblem("ü".repeat(24)), null);
  assert.match(shortTitleProblem("ü".repeat(25)), /25 characters/);

  const bare = item();
  delete bare.shortTitle;
  delete bare.i18n.de.shortTitle;
  const missing = await lintFeed([bare], { now: NOW });
  assert.deepEqual(missing.errors, []);
  assert.deepEqual(
    missing.warnings.filter((warning) => warning.includes("shortTitle")),
    [
      "pulse.json[0].shortTitle: missing; use about 3-5 words that say what changes",
      "pulse.json[0].i18n.de.shortTitle: missing; use about 3-5 words that say what changes",
    ],
  );

  const long = await lintFeed(
    [
      item({
        shortTitle: "A".repeat(25),
        i18n: { de: copy({ shortTitle: "B".repeat(24) }) },
      }),
    ],
    { now: NOW },
  );
  assert.deepEqual(long.errors, []);
  assert.deepEqual(long.warnings, [
    "pulse.json[0].shortTitle: is 25 characters; keep it to about 24",
  ]);

  const variant = levelVariant("Beginner");
  delete variant.shortTitle;
  delete variant.de.shortTitle;
  const level = await lintFeed([item({ levels: { beginner: variant } })], { now: NOW });
  assert.deepEqual(
    level.warnings.filter((warning) => warning.includes("shortTitle")),
    [
      "pulse.json[0].levels.beginner.shortTitle: missing; use about 3-5 words that say what changes",
      "pulse.json[0].levels.beginner.de.shortTitle: missing; use about 3-5 words that say what changes",
    ],
  );

  const notString = await lintFeed([item({ shortTitle: 4 })], { now: NOW });
  assert.match(notString.errors.join("\n"), /shortTitle: must be a string/);
});

test("warns on umlaut-less German spellings in de fields only", async () => {
  const broken = `Der Satz fur ueber 40 Arzte schlagt zu und l\u00e4\u00dft es so.`;
  const hits = umlautLessSpellings(broken).map((hit) => hit.term);
  assert.deepEqual(hits, ["fur", "ueber", "Arzte", "schlagt"]);
  assert.deepEqual(obsoleteEszettSpellings(broken).map((hit) => [hit.term, hit.expected]), [
    ["l\u00e4\u00dft", "l\u00e4sst"],
  ]);
  assert.equal(umlautLessSpellings("Beweisschritt, dass du musst, neue Quelle, heisst gross.").length, 0);
  assert.equal(obsoleteEszettSpellings("Er l\u00e4sst es und verl\u00e4sst den Raum.").length, 0);
  assert.equal(umlautLessSpellings("für über Ärzte schlägt zu und l\u00e4sst es so.").length, 0);

  const bad = await lintFeed(
    [
      item({
        hook: "A fur coat over ueber Arzte schlagt nothing here.",
        i18n: { de: copy({ hook: broken }) },
        levels: {
          beginner: levelVariant("Beginner", { de: { hook: "Sie sagt fuer den Test." } }),
        },
      }),
    ],
    { now: NOW },
  );
  assert.deepEqual(bad.errors, []);
  const warnings = bad.warnings.filter(
    (warning) => warning.includes("umlaut-less") || warning.includes("obsolete spelling"),
  );
  assert.equal(warnings.some((warning) => warning.includes("pulse.json[0].hook")), false);
  assert.match(warnings.join("\n"), /i18n\.de\.hook: umlaut-less spelling "fur"; use "für"/);
  assert.match(warnings.join("\n"), /umlaut-less spelling "ueber"; use "über"/);
  assert.match(warnings.join("\n"), /umlaut-less spelling "Arzte"; use "Ärzte"/);
  assert.match(warnings.join("\n"), /umlaut-less spelling "schlagt"; use "schlägt"/);
  assert.match(warnings.join("\n"), /obsolete spelling "l\u00e4\u00dft"; use "l\u00e4sst"/);
  assert.equal(warnings.some((warning) => warning.includes('spelling "l\u00e4sst"')), false);
  assert.match(warnings.join("\n"), /levels\.beginner\.de\.hook: umlaut-less spelling "fuer"; use "für"/);
});

function specificDeepDive(headings, body = "A short section.") {
  return headings.flatMap((heading) => [`## ${heading}`, "", body, ""]).join("\n");
}

test("deep dive accepts specific section headings and keeps the four-section check", async () => {
  const specific = specificDeepDive([
    "A refund request that got out of hand",
    "Six agents, one inbox and no human to ask",
    "Persistence turned into spam and leaked secrets",
    "Turn a vague goal into clear rules",
  ]);
  const ok = await lintFeed(
    [item({ deepDiveMarkdown: specific, i18n: { de: copy({ deepDiveMarkdown: specific }) } })],
    { now: NOW },
  );
  assert.deepEqual(ok.errors, []);

  const legacy = await lintFeed([item()], { now: NOW });
  assert.deepEqual(legacy.errors, []);

  const three = specificDeepDive(["One", "Two", "Three"]);
  const short = await lintFeed([item({ deepDiveMarkdown: three })], { now: NOW });
  assert.match(short.errors.join("\n"), /expected exactly 4 '## ' sections, found 3/);
});

function levelVariant(label, overrides = {}) {
  const { de: deOverrides = {}, ...rest } = overrides;
  const dive = (headingPrefix, body) =>
    specificDeepDive(
      [
        `${headingPrefix} opens the story`,
        `${headingPrefix} shows how it works`,
        `${headingPrefix} names the catch`,
        `${headingPrefix} tells you what to do`,
      ],
      body,
    );
  return {
    headline: `${label} headline`,
    hook: `${label} is a shorter version of the story.`,
    summaryPoints: [
      `${label} is the plain version of the claim.`,
      `${label} does not replace the source.`,
      `Check the ${label} limit before you act.`,
    ],
    shortTitle: `${label} short title`,
    takeaway: `Try the ${label} step once this week.`,
    deepDiveMarkdown: dive(label, `${label} section body.`),
    ...rest,
    de: {
      headline: `${label} Titel kurz`,
      shortTitle: `${label} Kurztitel`,
      hook: `${label} ist die kürzere Fassung der Geschichte.`,
      summaryPoints: [
        `${label} nennt die Quelle klar.`,
        `${label} nennt die Grenze klar.`,
        `${label} nennt den nächsten Schritt.`,
      ],
      takeaway: `Nutze die ${label} Fassung einmal.`,
      deepDiveMarkdown: dive(`${label} de`, `${label} Abschnitt.`),
      ...deOverrides,
    },
  };
}

test("accepts a levels object with distinct beginner and advanced variants", async () => {
  const result = await lintFeed(
    [
      item({
        levels: {
          beginner: levelVariant("Beginner"),
          advanced: levelVariant("Advanced", {
            hook: "OpenAI shipped Sol at a lower price after internal tests.",
            summaryPoints: [
              "OpenAI says Sol approaches Astra on coding and computer use.",
              "Those figures are the company's own comparisons.",
              "Compare one real task before you trust the price.",
            ],
          }),
        },
      }),
    ],
    { now: NOW },
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);

  const beginnerOnly = await lintFeed([item({ levels: { beginner: levelVariant("Beginner") } })], { now: NOW });
  assert.deepEqual(beginnerOnly.errors, []);
  assert.deepEqual(beginnerOnly.warnings, []);
});

test("rejects a levels variant with an unknown key, a missing field, or the wrong summary length", async () => {
  const unknown = await lintFeed(
    [item({ levels: { beginner: levelVariant("Beginner", { note: "extra" }) } })],
    { now: NOW },
  );
  assert.match(unknown.errors.join("\n"), /levels\.beginner: unexpected field note/);

  const missingHook = levelVariant("Beginner");
  delete missingHook.hook;
  const missing = await lintFeed([item({ levels: { beginner: missingHook } })], { now: NOW });
  assert.match(missing.errors.join("\n"), /levels\.beginner: missing hook/);

  const shortPoints = await lintFeed(
    [
      item({
        levels: {
          advanced: levelVariant("Advanced", { summaryPoints: ["Only the claim.", "Only the limit."] }),
        },
      }),
    ],
    { now: NOW },
  );
  assert.match(
    shortPoints.errors.join("\n"),
    /levels\.advanced\.summaryPoints: summaryPoints must contain exactly 3 strings/,
  );

  const empty = await lintFeed([item({ levels: {} })], { now: NOW });
  assert.match(empty.errors.join("\n"), /levels: must include beginner or advanced/);
});

test("variant headlines use the root length rules", async () => {
  const longEn = await lintFeed(
    [item({ levels: { beginner: levelVariant("Beginner", { headline: "A".repeat(33) }) } })],
    { now: NOW },
  );
  assert.match(longEn.errors.join("\n"), /levels\.beginner\.headline: must be <= 32 characters \(is 33\)/);
  assert.equal(longEn.warnings.some((warning) => warning.includes("characters")), false);

  const longDe = await lintFeed(
    [item({ levels: { advanced: levelVariant("Advanced", { de: { headline: "B".repeat(33) } }) } })],
    { now: NOW },
  );
  assert.match(longDe.errors.join("\n"), /levels\.advanced\.de\.headline: must be <= 32 characters \(is 33\)/);

  const warnEn = await lintFeed(
    [item({ levels: { beginner: levelVariant("Beginner", { headline: "C".repeat(30) }) } })],
    { now: NOW },
  );
  assert.deepEqual(warnEn.errors, []);
  assert.deepEqual(warnEn.warnings, [
    "pulse.json[0].levels.beginner.headline: is 30 characters; aim for 27 or fewer",
  ]);
});

test("rejects a variant that copies root text", async () => {
  const base = item();
  const result = await lintFeed(
    [
      item({
        levels: {
          beginner: levelVariant("Beginner", {
            hook: base.hook,
            de: { headline: base.i18n.de.headline },
          }),
          advanced: levelVariant("Advanced", {
            summaryPoints: base.summaryPoints,
            deepDiveMarkdown: base.deepDiveMarkdown,
          }),
        },
      }),
    ],
    { now: NOW },
  );
  assert.deepEqual(result.errors, [
    "pulse.json[0].levels.beginner.de.headline: must not copy the root text",
    "pulse.json[0].levels.beginner.hook: must not copy the root text",
    "pulse.json[0].levels.advanced.summaryPoints: must not copy the root text",
    "pulse.json[0].levels.advanced.deepDiveMarkdown: must not copy the root text",
  ]);
});

test("variant English card fields keep glossary and deep-dive checks", async () => {
  const capped = await lintFeed(
    [
      item({
        levels: {
          beginner: levelVariant("Beginner", {
            takeaway: "Ask the Agent before you ship the change.",
          }),
        },
      }),
    ],
    { now: NOW },
  );
  assert.match(capped.errors.join("\n"), /levels\.beginner\.takeaway: capitalised glossary term "Agent"/);

  const shortDive = await lintFeed(
    [
      item({
        levels: {
          advanced: levelVariant("Advanced", {
            deepDiveMarkdown: specificDeepDive(["One", "Two ends here.", "Three"]),
          }),
        },
      }),
    ],
    { now: NOW },
  );
  assert.match(
    shortDive.errors.join("\n"),
    /levels\.advanced\.deepDiveMarkdown: expected exactly 4 '## ' sections, found 3/,
  );
});

test("deep dive headings stay short and never end with a period", async () => {
  const long = specificDeepDive([
    "This heading has far too many words to pass the check",
    "Two",
    "Three",
    "Four",
  ]);
  const tooLong = await lintFeed([item({ deepDiveMarkdown: long })], { now: NOW });
  assert.match(tooLong.errors.join("\n"), /section 1 heading .* at most 9 words/);

  const period = specificDeepDive(["One", "Two ends here.", "Three", "Four"]);
  const dotted = await lintFeed([item({ deepDiveMarkdown: period })], { now: NOW });
  assert.match(dotted.errors.join("\n"), /section 2 heading .* must not end with a period/);
});
