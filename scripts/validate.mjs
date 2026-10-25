import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(root, "schema", "pulse.schema.json");
const pulsePath = join(root, "pulse.json");

const TAGS = [
  "Model Release",
  "Framework",
  "Autonomous Agent",
  "Benchmarks",
  "Hardware",
  "Tools",
];

const PRIORITIES = ["normal", "breaking"];

// Each deep dive has exactly four "## " sections (entry, how it works, the catch,
// what to do). Headings are specific statements about the story, not fixed labels.
export const MAX_HEADING_WORDS = 9;

const ITEM_KEYS = [
  "id",
  "date",
  "tag",
  "priority",
  "readTimeMinutes",
  "listenTimeMinutes",
  "hook",
  "headline",
  "summaryPoints",
  "takeaway",
  "deepDiveMarkdown",
  "source",
  "i18n",
  "levels",
  "shortTitle",
];

const COPY_KEYS = ["headline", "hook", "summaryPoints", "takeaway", "deepDiveMarkdown"];
const REQUIRED_COPY_KEYS = ["headline", "hook", "summaryPoints", "deepDiveMarkdown"];
const ALLOWED_COPY_KEYS = [...COPY_KEYS, "shortTitle"];
const LEVEL_NAMES = ["beginner", "advanced"];
const VARIANT_KEYS = [...ALLOWED_COPY_KEYS, "de"];

export const MAX_SHORT_TITLE_CHARS = 24;

const ID_RE = /^pulse-[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_RE =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;

// Lemmas are lowercase. Longest first so "tokens" wins over "token".
const GLOSSARY_LEMMAS = [
  "context windows",
  "context window",
  "open weights",
  "fine-tuning",
  "benchmarks",
  "benchmark",
  "agents",
  "agent",
  "tokens",
  "token",
  "reasoning",
  "inference",
];

// Product names may contain a glossary word. Matched exactly, case-sensitive.
export const PRODUCT_NAME_ALLOWLIST = [
  "Open Agent Safety Platform",
  "Claude Managed Agents",
  "Microsoft Agent 365",
  "Agent Toolkit",
  "1Password for Agents",
];

const CARD_FIELDS = ["headline", "hook", "summaryPoints", "takeaway"];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function glossaryPattern() {
  return new RegExp(`\\b(?:${GLOSSARY_LEMMAS.map(escapeRegExp).join("|")})\\b`, "gi");
}

function sentenceForm(lower) {
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function usesHeadlineCasing(text) {
  const words = String(text).match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  const significant = words.filter((word) => word.replace(/[^A-Za-z]/g, "").length >= 4);
  if (significant.length === 0) return false;
  return significant.every((word) => /^[A-Z]/.test(word));
}

export function isSentenceStart(text, index) {
  const before = text.slice(0, index);
  if (before.trim() === "") return true;
  const trailingWs = before.match(/\s*$/)[0];
  const core = before.slice(0, before.length - trailingWs.length);
  if (core === "") return true;
  if (/[.!?]["'”’)\]]*$/.test(core)) return true;
  if (trailingWs.includes("\n")) return true;
  return false;
}

function productSpans(text) {
  const spans = [];
  for (const name of PRODUCT_NAME_ALLOWLIST) {
    let from = 0;
    while (from < text.length) {
      const at = text.indexOf(name, from);
      if (at === -1) break;
      spans.push([at, at + name.length]);
      from = at + name.length;
    }
  }
  return spans;
}

function spanCovers(spans, index) {
  return spans.some(([start, end]) => index >= start && index < end);
}

// A title-cased word starts with a capital. Two or more in a row are a proper name
// ("Personal Agent Protocol", "Critical Infrastructure Defense Program").
const CAPITAL_WORD = "[A-Z][A-Za-z'-]*";
const LEADING_ARTICLE_RE = /^(?:The|A|An)\s+/;

function properNameSpans(text) {
  const spans = [];
  const re = new RegExp(`\\b${CAPITAL_WORD}(?:\\s+${CAPITAL_WORD})+\\b`, "g");
  const body = new RegExp(`^${CAPITAL_WORD}(?:\\s+${CAPITAL_WORD})+$`);
  for (const match of text.matchAll(re)) {
    let start = match.index ?? 0;
    let raw = match[0];
    const article = LEADING_ARTICLE_RE.exec(raw);
    if (article) {
      raw = raw.slice(article[0].length);
      start += article[0].length;
      if (!body.test(raw)) continue;
    }
    spans.push([start, start + raw.length]);
  }
  return spans;
}

function insideProperName(spans, index, term) {
  if (/\s/.test(term)) return false;
  return spanCovers(spans, index);
}

function expectedGlossaryForm(match, lower, index, text) {
  if (match === lower) return null;
  if (isSentenceStart(text, index) && match === sentenceForm(lower)) return null;
  if (isSentenceStart(text, index)) return sentenceForm(lower);
  return lower;
}

export function glossaryViolations(text, { headline = false } = {}) {
  if (typeof text !== "string" || text === "") return [];
  if (headline && usesHeadlineCasing(text)) return [];
  const products = productSpans(text);
  const names = properNameSpans(text);
  const hits = [];
  for (const match of text.matchAll(glossaryPattern())) {
    const term = match[0];
    const index = match.index ?? 0;
    if (spanCovers(products, index) || insideProperName(names, index, term)) continue;
    const expected = expectedGlossaryForm(term, term.toLowerCase(), index, text);
    if (!expected) continue;
    hits.push({ term, index, expected });
  }
  return hits;
}

export function lowercaseGlossaryTerms(text, { headline = false } = {}) {
  if (typeof text !== "string") return text;
  if (headline && usesHeadlineCasing(text)) return text;
  const products = productSpans(text);
  const names = properNameSpans(text);
  return text.replace(glossaryPattern(), (match, offset) => {
    if (spanCovers(products, offset) || insideProperName(names, offset, match)) return match;
    const expected = expectedGlossaryForm(match, match.toLowerCase(), offset, text);
    return expected ?? match;
  });
}

export function explainsSubject(text) {
  if (typeof text !== "string" || text.trim() === "") return false;
  if (/\b(?:is|are|was|were)\s+(?:a|an|the|named|built|meant|designed|used|open|one)\b/i.test(text)) {
    return true;
  }
  if (/,\s+(?:a|an)\s+/i.test(text)) return true;
  if (/\b(?:means|refers to|built for|built to|short for)\b/i.test(text)) return true;
  if (/,\s+[a-z][^.]{0,80}\bthat\b/.test(text)) return true;
  return false;
}

export function httpsUrlError(url) {
  if (typeof url !== "string" || url.trim() === "" || /\s/.test(url)) {
    return "must be a well-formed https URL";
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "must be a well-formed https URL";
  }
  if (parsed.protocol !== "https:") return "must use https";
  if (parsed.username || parsed.password) return "must not include credentials";
  if (!parsed.hostname || !parsed.hostname.includes(".")) return "must have a host name";
  return null;
}

export function canonicalSourceUrl(url) {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const port = parsed.port ? `:${parsed.port}` : "";
  let pathname = parsed.pathname || "/";
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  return `https://${hostname}${port}${pathname}${parsed.search}`;
}

export async function fetchHttpStatus(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "Sapaude-Content-validator/1.0 (+https://github.com/niklasgalli-oss/Sapaude-Content)",
      },
    });
    await response.body?.cancel();
    return response.status;
  } catch (error) {
    const message = error?.name === "TimeoutError" ? "timed out" : error.message;
    return `request failed (${message})`;
  }
}

export function collectSchemaErrors(schema) {
  const errors = [];
  const fail = (message) => errors.push(`schema: ${message}`);
  if (!schema || schema.type !== "array") fail("root type must be array");
  if (schema?.maxItems !== 12) fail("maxItems must be 12");
  if (schema?.minItems !== 1) fail("minItems must be 1");
  const item = schema?.$defs?.dailyPulseItem;
  const tags = item?.properties?.tag?.enum;
  if (!Array.isArray(tags) || tags.join("|") !== TAGS.join("|")) {
    fail("tag enum drifted from the validator");
  }
  const priority = item?.properties?.priority;
  const priorityEnum = priority?.enum;
  if (priority?.type !== "string" || !Array.isArray(priorityEnum) || priorityEnum.join("|") !== PRIORITIES.join("|")) {
    fail("priority must be an optional string enum of normal or breaking");
  }
  if (item?.required?.includes("priority")) fail("priority must not be required");
  if (item?.required?.includes("takeaway")) fail("takeaway must not be required");
  if (item?.required?.includes("shortTitle")) fail("shortTitle must not be required");
  if (item?.properties?.takeaway?.type !== "string") fail("takeaway must be a string");
  if ((item?.properties?.takeaway?.minLength ?? 0) > 0) fail("takeaway must allow an empty string");
  if (item?.properties?.shortTitle?.type !== "string") fail("shortTitle must be an optional string");
  if (item?.properties?.headline?.maxLength !== 32) fail("headline maxLength must be 32");
  if (schema?.$defs?.localizedCopy?.properties?.headline?.maxLength !== 32) {
    fail("localized headline maxLength must be 32");
  }
  const points = item?.properties?.summaryPoints;
  if (points?.minItems !== 3 || points?.maxItems !== 3) fail("summaryPoints must be exactly 3");
  if (!item?.properties?.i18n?.required?.includes("de")) fail("i18n.de must be required");
  if (item?.required?.includes("levels")) fail("levels must not be required");
  const levels = item?.properties?.levels;
  if (levels?.type !== "object" || levels?.additionalProperties !== false || levels?.minProperties !== 1) {
    fail("levels must be an object with at least one variant and no extra fields");
  }
  const levelNames = Object.keys(levels?.properties ?? {}).sort();
  if (levelNames.join("|") !== "advanced|beginner") {
    fail("levels may contain only beginner and advanced");
  }
  if (
    levels?.properties?.beginner?.$ref !== "#/$defs/levelVariant" ||
    levels?.properties?.advanced?.$ref !== "#/$defs/levelVariant"
  ) {
    fail("beginner and advanced must use the level variant schema");
  }
  const variant = schema?.$defs?.levelVariant;
  if (variant?.type !== "object" || variant?.additionalProperties !== false) {
    fail("level variant must reject extra fields");
  }
  const variantRequired = [...(variant?.required ?? [])].sort();
  if (variantRequired.join("|") !== "de|deepDiveMarkdown|headline|hook|summaryPoints") {
    fail("level variant must require headline, hook, summaryPoints, deepDiveMarkdown, and de");
  }
  if (variant?.required?.includes("takeaway")) fail("level variant takeaway must not be required");
  if (variant?.required?.includes("shortTitle")) fail("level variant shortTitle must not be required");
  if (variant?.properties?.shortTitle?.type !== "string") fail("level variant shortTitle must be a string");
  if (variant?.properties?.takeaway?.type !== "string") fail("level variant takeaway must be a string");
  if ((variant?.properties?.takeaway?.minLength ?? 0) > 0) {
    fail("level variant takeaway must allow an empty string");
  }
  if (variant?.properties?.headline?.maxLength !== 32) fail("level variant headline maxLength must be 32");
  const variantPoints = variant?.properties?.summaryPoints;
  if (variantPoints?.minItems !== 3 || variantPoints?.maxItems !== 3) {
    fail("level variant summaryPoints must be exactly 3");
  }
  if (variant?.properties?.de?.$ref !== "#/$defs/localizedCopy") {
    fail("level variant de must use localizedCopy");
  }
  const localized = schema?.$defs?.localizedCopy;
  if (localized?.additionalProperties !== false) {
    fail("localized copy must reject extra fields");
  }
  if (localized?.required?.includes("takeaway")) fail("localized takeaway must not be required");
  if (localized?.required?.includes("shortTitle")) fail("localized shortTitle must not be required");
  if (localized?.properties?.takeaway?.type !== "string") fail("localized takeaway must be a string");
  if ((localized?.properties?.takeaway?.minLength ?? 0) > 0) {
    fail("localized takeaway must allow an empty string");
  }
  if (localized?.properties?.shortTitle?.type !== "string") fail("localized shortTitle must be a string");
  for (const key of ["readTimeMinutes", "listenTimeMinutes"]) {
    const field = item?.properties?.[key];
    if (field?.type !== "integer" || field?.minimum !== 1 || field?.maximum !== 30) {
      fail(`${key} must be an integer from 1 to 30`);
    }
  }
  const source = item?.properties?.source;
  if (source?.additionalProperties !== false) fail("source must reject extra fields");
  const sourceRequired = source?.required ?? [];
  if (sourceRequired.length !== 2 || !sourceRequired.includes("name") || !sourceRequired.includes("url")) {
    fail("source must require name and url only");
  }
  const urlPattern = source?.properties?.url?.pattern ?? "";
  if (!urlPattern.startsWith("^https://")) fail("source.url pattern must require https");
  return errors;
}

function headingsOf(markdown) {
  return String(markdown)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("## "));
}

export function headingProblem(heading) {
  const text = String(heading).replace(/^##\s+/, "").trim();
  if (text === "") return "must not be empty";
  const words = text.split(/\s+/).length;
  if (words > MAX_HEADING_WORDS) return `must be at most ${MAX_HEADING_WORDS} words (has ${words})`;
  if (text.endsWith(".")) return "must not end with a period";
  return null;
}

function checkDeepDive(fail, path, markdown) {
  if (typeof markdown !== "string" || markdown.trim() === "") {
    fail(path, "deepDiveMarkdown must be a non-empty string");
    return;
  }
  const found = headingsOf(markdown);
  if (found.length !== 4) {
    fail(path, `expected exactly 4 '## ' sections, found ${found.length}`);
    return;
  }
  found.forEach((heading, i) => {
    const problem = headingProblem(heading);
    if (problem) fail(path, `section ${i + 1} heading "${heading}" ${problem}`);
  });
}

function checkSummary(fail, path, points) {
  if (!Array.isArray(points) || points.length !== 3) {
    fail(path, "summaryPoints must contain exactly 3 strings");
    return;
  }
  points.forEach((point, index) => {
    if (typeof point !== "string" || point.trim() === "") {
      fail(`${path}[${index}]`, "summary point must be a non-empty string");
    }
  });
}

function checkHeadline(fail, warn, path, headline) {
  if (typeof headline !== "string") {
    fail(`${path}.headline`, "must be a string");
    return;
  }
  const length = [...headline].length;
  if (length > 32) {
    fail(`${path}.headline`, `must be <= 32 characters (is ${length})`);
  } else if (headline.trim() === "") {
    fail(`${path}.headline`, "must be non-empty");
  } else if (length >= 28) {
    warn(`${path}.headline`, `is ${length} characters; aim for 27 or fewer`);
  }
}

function sameText(left, right) {
  if (typeof left === "string" && typeof right === "string") return left === right;
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function copyFieldsOf(source) {
  const copy = {};
  if (source === null || typeof source !== "object" || Array.isArray(source)) return copy;
  for (const key of COPY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) copy[key] = source[key];
  }
  return copy;
}

function checkCopiedText(fail, path, variantText, rootText) {
  if (rootText === null || typeof rootText !== "object" || Array.isArray(rootText)) return;
  for (const key of COPY_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(variantText, key)) continue;
    if (!sameText(variantText[key], rootText[key])) continue;
    fail(`${path}.${key}`, "must not copy the root text");
  }
}

function checkLevelVariant(fail, warn, path, variant, rootEn, rootDe) {
  if (variant === null || typeof variant !== "object" || Array.isArray(variant)) {
    fail(path, "must be an object");
    return;
  }
  for (const key of Object.keys(variant)) {
    if (!VARIANT_KEYS.includes(key)) fail(path, `unexpected field ${key}`);
  }
  checkLocalized(fail, path, copyFieldsOf(variant), warn);
  checkShortTitle(fail, warn, path, variant);
  if (typeof variant.shortTitle === "string") {
    checkGlossaryField(fail, `${path}.shortTitle`, variant.shortTitle, { headline: true });
  }
  for (const field of CARD_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(variant, field)) continue;
    if (field === "summaryPoints") {
      if (Array.isArray(variant.summaryPoints)) {
        variant.summaryPoints.forEach((point, pointIndex) => {
          checkGlossaryField(fail, `${path}.summaryPoints[${pointIndex}]`, point);
        });
      }
    } else {
      checkGlossaryField(fail, `${path}.${field}`, variant[field], { headline: field === "headline" });
    }
  }
  if (!Object.prototype.hasOwnProperty.call(variant, "de")) {
    fail(path, "missing de");
  } else {
    checkLocalized(fail, `${path}.de`, variant.de, warn);
    if (variant.de !== null && typeof variant.de === "object" && !Array.isArray(variant.de)) {
      checkShortTitle(fail, warn, `${path}.de`, variant.de);
      warnGermanUmlauts(warn, `${path}.de`, variant.de);
      checkCopiedText(fail, `${path}.de`, variant.de, rootDe);
    }
  }
  checkCopiedText(fail, path, variant, rootEn);
}

// Root fields stay the intermediate text. beginner and advanced are whole
// variants: omit one instead of leaving it empty, and do not repeat root text.
// Advanced variants do not use the beginner-sentence warning.
function checkLevels(fail, warn, path, levels, item) {
  if (levels === null || typeof levels !== "object" || Array.isArray(levels)) {
    fail(path, "must be an object with beginner and/or advanced");
    return;
  }
  const names = Object.keys(levels);
  if (names.length === 0) {
    fail(path, "must include beginner or advanced; omit levels instead of an empty object");
  }
  for (const key of names) {
    if (!LEVEL_NAMES.includes(key)) fail(path, `unexpected field ${key}`);
  }
  const rootDe =
    item.i18n && typeof item.i18n === "object" && !Array.isArray(item.i18n) ? item.i18n.de : undefined;
  for (const name of LEVEL_NAMES) {
    if (!Object.prototype.hasOwnProperty.call(levels, name)) continue;
    checkLevelVariant(fail, warn, `${path}.${name}`, levels[name], copyFieldsOf(item), rootDe);
  }
}

// Spellings that dropped an umlaut (fuer, ueber, Arzte, schlagt). ss after a
// short vowel is correct (lässt, not obsolete läßt) and is not listed here.
// Longer forms come first so "ueberhaupt" is reported ahead of "ueber".
const UMLAUT_LESS = [
  ["ueberhaupt", "überhaupt"],
  ["uebernehmen", "übernehmen"],
  ["ueberpruefen", "überprüfen"],
  ["uebersetzen", "übersetzen"],
  ["ueber", "über"],
  ["fuer", "für"],
  ["fur", "für"],
  ["uber", "über"],
  ["arzte", "ärzte"],
  ["schlaegt", "schlägt"],
  ["schlagt", "schlägt"],
  ["moeglich", "möglich"],
  ["moglich", "möglich"],
  ["koennen", "können"],
  ["konnen", "können"],
  ["muessen", "müssen"],
  ["mussen", "müssen"],
  ["waere", "wäre"],
  ["wuerde", "würde"],
  ["naechsten", "nächsten"],
  ["naechster", "nächster"],
  ["naechste", "nächste"],
  ["aenderungen", "Änderungen"],
  ["aenderung", "Änderung"],
  ["aendern", "ändern"],
  ["pruefen", "prüfen"],
  ["prufen", "prüfen"],
  ["oeffnen", "öffnen"],
  ["offnen", "öffnen"],
  ["zurueck", "zurück"],
  ["zuruck", "zurück"],
  ["oeffentlich", "öffentlich"],
  ["offentlich", "öffentlich"],
  ["waehrend", "während"],
  ["aehnlich", "ähnlich"],
  ["ahnlich", "ähnlich"],
  ["natuerlich", "natürlich"],
  ["naturlich", "natürlich"],
  ["zusaetzlich", "zusätzlich"],
  ["zusatzlich", "zusätzlich"],
  ["gefaehrlich", "gefährlich"],
  ["kuerzere", "kürzere"],
  ["kuerzer", "kürzer"],
  ["spaeter", "später"],
  ["frueher", "früher"],
  ["koennte", "könnte"],
  ["moechte", "möchte"],
  ["groesseren", "größeren"],
  ["groesser", "größer"],
  ["verlaesst", "verlässt"],
  ["laesst", "lässt"],
].sort((left, right) => right[0].length - left[0].length);

// Pre-1996 ß after a short vowel. The reform spelling is ss: lässt, not läßt.
const OBSOLETE_ESZETT = [
  ["offenl\u00e4\u00dft", "offenl\u00e4sst"],
  ["verl\u00e4\u00dft", "verl\u00e4sst"],
  ["l\u00e4\u00dft", "l\u00e4sst"],
].sort((left, right) => right[0].length - left[0].length);

function umlautBoundary(word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "giu");
}

function applyUmlautCase(sample, replacement) {
  if (sample.length === 0 || sample[0].toLowerCase() === sample[0]) return replacement;
  return replacement[0].toUpperCase() + replacement.slice(1);
}

function spellingHits(text, pairs) {
  if (typeof text !== "string" || text === "") return [];
  const hits = [];
  for (const [bad, good] of pairs) {
    for (const match of text.matchAll(umlautBoundary(bad))) {
      hits.push({
        term: match[0],
        index: match.index ?? 0,
        expected: applyUmlautCase(match[0], good),
      });
    }
  }
  hits.sort((left, right) => left.index - right.index || right.term.length - left.term.length);
  return hits;
}

export function umlautLessSpellings(text) {
  return spellingHits(text, UMLAUT_LESS);
}

export function obsoleteEszettSpellings(text) {
  return spellingHits(text, OBSOLETE_ESZETT);
}

function warnGermanUmlauts(warn, path, copy) {
  if (copy === null || typeof copy !== "object" || Array.isArray(copy)) return;
  const scan = (fieldPath, value) => {
    if (typeof value === "string") {
      for (const hit of umlautLessSpellings(value)) {
        warn(fieldPath, `umlaut-less spelling "${hit.term}"; use "${hit.expected}"`);
      }
      for (const hit of obsoleteEszettSpellings(value)) {
        warn(fieldPath, `obsolete spelling "${hit.term}"; use "${hit.expected}"`);
      }
      return;
    }
    if (!Array.isArray(value)) return;
    value.forEach((item, index) => scan(`${fieldPath}[${index}]`, item));
  };
  for (const [key, value] of Object.entries(copy)) {
    scan(`${path}.${key}`, value);
  }
}

export function shortTitleProblem(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return "missing; use about 3-5 words that say what changes";
  }
  const length = [...value].length;
  if (length > MAX_SHORT_TITLE_CHARS) return `is ${length} characters; keep it to about 24`;
  return null;
}

function checkShortTitle(fail, warn, path, source) {
  if (source === null || typeof source !== "object" || Array.isArray(source)) return;
  if (Object.prototype.hasOwnProperty.call(source, "shortTitle") && typeof source.shortTitle !== "string") {
    fail(`${path}.shortTitle`, "must be a string");
    return;
  }
  const problem = shortTitleProblem(source.shortTitle);
  if (problem) warn(`${path}.shortTitle`, problem);
}

function checkLocalized(fail, path, copy, warn = () => {}) {
  if (copy === null || typeof copy !== "object" || Array.isArray(copy)) {
    fail(path, "localized copy must be an object");
    return;
  }
  for (const key of Object.keys(copy)) {
    if (!ALLOWED_COPY_KEYS.includes(key)) fail(path, `unexpected field ${key}`);
  }
  for (const key of REQUIRED_COPY_KEYS) {
    if (!(key in copy)) fail(path, `missing ${key}`);
  }
  checkHeadline(fail, warn, path, copy.headline);
  if (typeof copy.hook !== "string" || copy.hook.trim() === "") {
    fail(`${path}.hook`, "must be a non-empty string");
  }
  if (Object.prototype.hasOwnProperty.call(copy, "takeaway") && typeof copy.takeaway !== "string") {
    fail(`${path}.takeaway`, "must be a string");
  }
  checkSummary(fail, `${path}.summaryPoints`, copy.summaryPoints);
  checkDeepDive(fail, `${path}.deepDiveMarkdown`, copy.deepDiveMarkdown);
}

function checkGlossaryField(fail, path, text, { headline = false } = {}) {
  if (typeof text !== "string") return;
  for (const hit of glossaryViolations(text, { headline })) {
    fail(
      path,
      `capitalised glossary term "${hit.term}"; use "${hit.expected}" unless it is a product name, starts a sentence, or sits inside a title-cased proper name`,
    );
  }
}

export async function lintFeed(pulse, options = {}) {
  const errors = [];
  const warnings = [];
  const fail = (path, message) => errors.push(`${path}: ${message}`);
  const warn = (path, message) => warnings.push(`${path}: ${message}`);
  const now = options.now ?? Date.now();

  if (!Array.isArray(pulse)) {
    fail("pulse.json", "must be a JSON array");
    return { errors, warnings };
  }
  if (pulse.length < 1 || pulse.length > 12) {
    fail("pulse.json", `must contain 1 to 12 items (has ${pulse.length})`);
  }

  const ids = new Map();
  const urls = new Map();
  const urlChecks = [];

  pulse.forEach((item, index) => {
    const path = `pulse.json[${index}]`;
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      fail(path, "must be an object");
      return;
    }
    for (const key of Object.keys(item)) {
      if (!ITEM_KEYS.includes(key)) fail(path, `unexpected field ${key}`);
    }
    if (typeof item.id !== "string" || !ID_RE.test(item.id)) {
      fail(`${path}.id`, "must match pulse-YYYY-MM-DD-short-slug");
    } else if (ids.has(item.id)) {
      fail(`${path}.id`, `duplicate id ${item.id} (also ${ids.get(item.id)}); ids are never reused`);
    } else {
      ids.set(item.id, path);
    }
    if (typeof item.date !== "string" || !ISO_RE.test(item.date) || Number.isNaN(Date.parse(item.date))) {
      fail(`${path}.date`, "must be an ISO-8601 UTC timestamp with millisecond precision");
    } else {
      if (typeof item.id === "string" && !item.id.startsWith(`pulse-${item.date.slice(0, 10)}-`)) {
        fail(`${path}.id`, "date prefix must match the UTC calendar date");
      }
      if (Date.parse(item.date) > now) fail(`${path}.date`, "must not be in the future");
    }
    if (!TAGS.includes(item.tag)) fail(`${path}.tag`, `must be one of ${TAGS.join(", ")}`);
    if (Object.prototype.hasOwnProperty.call(item, "priority") && !PRIORITIES.includes(item.priority)) {
      fail(`${path}.priority`, `must be one of ${PRIORITIES.join(", ")} when set`);
    }
    for (const key of ["readTimeMinutes", "listenTimeMinutes"]) {
      const value = item[key];
      if (!Number.isInteger(value) || value < 1 || value > 30) {
        fail(`${path}.${key}`, "must be a positive whole number of minutes from 1 to 30");
      }
    }
    const rootCopy = {
      headline: item.headline,
      hook: item.hook,
      summaryPoints: item.summaryPoints,
      deepDiveMarkdown: item.deepDiveMarkdown,
    };
    if (Object.prototype.hasOwnProperty.call(item, "takeaway")) rootCopy.takeaway = item.takeaway;
    checkLocalized(fail, path, rootCopy, warn);
    checkShortTitle(fail, warn, path, item);
    if (typeof item.shortTitle === "string") {
      checkGlossaryField(fail, `${path}.shortTitle`, item.shortTitle, { headline: true });
    }
    for (const field of CARD_FIELDS) {
      if (field === "summaryPoints") {
        if (Array.isArray(item.summaryPoints)) {
          item.summaryPoints.forEach((point, pointIndex) => {
            checkGlossaryField(fail, `${path}.summaryPoints[${pointIndex}]`, point);
          });
        }
      } else {
        checkGlossaryField(fail, `${path}.${field}`, item[field], { headline: field === "headline" });
      }
    }
    const hookOk = typeof item.hook === "string" && item.hook.trim() !== "";
    const firstPoint = Array.isArray(item.summaryPoints) ? item.summaryPoints[0] : undefined;
    const pointOk = typeof firstPoint === "string" && firstPoint.trim() !== "";
    if (hookOk && pointOk && !explainsSubject(item.hook) && !explainsSubject(firstPoint)) {
      warn(
        path,
        "beginner sentence: hook or summaryPoints[0] should say what this is, in plain language, before the news",
      );
    }
    const source = item.source;
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      fail(`${path}.source`, "must be an object with name and url");
    } else {
      for (const key of Object.keys(source)) {
        if (key !== "name" && key !== "url") fail(`${path}.source`, `unexpected field ${key}`);
      }
      if (typeof source.name !== "string" || source.name.trim() === "") {
        fail(`${path}.source.name`, "must be a non-empty publisher name");
      }
      const urlProblem = httpsUrlError(source.url);
      if (urlProblem) {
        fail(`${path}.source.url`, urlProblem);
      } else {
        const canonical = canonicalSourceUrl(source.url);
        if (urls.has(canonical)) {
          fail(
            `${path}.source.url`,
            `duplicate of ${urls.get(canonical)}; do not reuse a source URL under a new headline`,
          );
        } else {
          urls.set(canonical, item.id ?? path);
        }
        urlChecks.push({ path: `${path}.source.url`, url: source.url });
      }
    }
    if (!item.i18n || typeof item.i18n !== "object" || Array.isArray(item.i18n)) {
      fail(`${path}.i18n`, "must be an object with de");
    } else if (!item.i18n.de) {
      fail(`${path}.i18n.de`, "German copy is required");
    } else {
      for (const [locale, copy] of Object.entries(item.i18n)) {
        checkLocalized(fail, `${path}.i18n.${locale}`, copy, warn);
        checkShortTitle(fail, warn, `${path}.i18n.${locale}`, copy);
        if (locale === "de") warnGermanUmlauts(warn, `${path}.i18n.${locale}`, copy);
      }
    }
    if (Object.prototype.hasOwnProperty.call(item, "levels")) {
      checkLevels(fail, warn, `${path}.levels`, item.levels, item);
    }
  });

  if (options.checkUrls) {
    const fetchStatus = options.fetchUrl ?? fetchHttpStatus;
    const results = await Promise.all(
      urlChecks.map(async (target) => ({ ...target, status: await fetchStatus(target.url) })),
    );
    for (const result of results) {
      if (result.status !== 200) {
        const detail = typeof result.status === "number" ? `HTTP ${result.status}` : result.status;
        fail(result.path, `expected HTTP 200, got ${detail}`);
      }
    }
  }

  return { errors, warnings };
}

function loadJson(path, fail) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    fail(path, `unreadable (${error.message})`);
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(path, `invalid JSON (${error.message})`);
    return null;
  }
}

function parseArgs(argv) {
  let checkUrls = false;
  for (const arg of argv) {
    if (arg === "--check-urls") checkUrls = true;
    else if (arg === "--help" || arg === "-h") return { help: true, checkUrls: false };
    else throw new Error(`unknown argument: ${arg}`);
  }
  return { help: false, checkUrls };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/validate.mjs [--check-urls]");
    console.log("Checks schema/pulse.schema.json and pulse.json.");
    console.log("--check-urls requests each source URL and requires HTTP 200.");
    return;
  }

  const errors = [];
  const fail = (path, message) => errors.push(`${path}: ${message}`);
  const schema = loadJson(schemaPath, fail);
  const pulse = loadJson(pulsePath, fail);
  if (schema) errors.push(...collectSchemaErrors(schema));
  let warnings = [];
  if (pulse) {
    const result = await lintFeed(pulse, { checkUrls: args.checkUrls, now: Date.now() });
    errors.push(...result.errors);
    warnings = result.warnings;
  }

  if (errors.length > 0) {
    console.error(`pulse.json failed validation (${errors.length} error${errors.length === 1 ? "" : "s"})`);
    for (const error of errors) console.error(`- ${error}`);
  }
  if (warnings.length > 0) {
    console.error(`pulse.json warnings (${warnings.length})`);
    for (const warning of warnings) console.error(`- ${warning}`);
  }
  if (errors.length > 0) process.exit(1);

  const count = Array.isArray(pulse) ? pulse.length : 0;
  const warningNote = warnings.length === 0 ? "" : `, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`;
  console.log(`pulse.json ok (${count} item${count === 1 ? "" : "s"}${warningNote})`);
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
