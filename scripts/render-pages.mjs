/**
 * Render crawlable HTML from pulse.json and briefing.json.
 *
 * The app keeps fetching the JSON files. This script only writes HTML under
 * docs/ and docs/sitemap.xml. It does not change the feed schema or bytes.
 *
 * Run: node scripts/render-pages.mjs
 * Check: node scripts/render-pages.mjs --check
 *
 * Article URLs use the stable pulse id (without the pulse- prefix) in both
 * languages, so a headline edit does not move the page. Old article folders
 * stay on disk after an item rolls off the feed, and the sitemap keeps them.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ORIGIN = "https://sapaude.app";

const JARGON = /open[- ]?weights|benchmarks?|per million|pro Million|\bAPI\b|\$\s?\d|\d\s?\$|parameter|MoE|context window|\binference\b|GPT-\d|\bvon\s+\d{2,}\b|\bof\s+\d{2,}\b|llama|vLLM|Token-Limit|pro Token/i;

const TAG_LABEL = {
  en: {
    "Model Release": "New model",
    "Autonomous Agent": "AI agents",
    Benchmarks: "Study",
    Tools: "Everyday tool",
    Framework: "In the background",
    Hardware: "Device"
  },
  de: {
    "Model Release": "Neues Modell",
    "Autonomous Agent": "KI-Agenten",
    Benchmarks: "Studie",
    Tools: "Alltags-Tool",
    Framework: "Im Hintergrund",
    Hardware: "Gerät"
  }
};

const MONTHS = {
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
};

const COPY = {
  de: {
    lang: "de",
    home: "",
    claim: "Veni, vidi, KI.",
    skip: "Zum Inhalt",
    contentId: "inhalt",
    other: "English",
    otherLang: "en",
    briefing: "Briefing",
    homeLabel: "Start",
    published: "Stand",
    read: "Lesezeit",
    minutes: "Minuten",
    minute: "Minute",
    listen: "Hörfassung in der App",
    listenNote: "Hören im Briefing ist Sapaude Pro.",
    pointsHeading: "In drei Punkten",
    pointsIntro: "Drei Punkte, in dieser Reihenfolge: was die Quelle zeigt, wo die Aussage endet, und was du als Nächstes prüfst.",
    takeaway: "Was du tun kannst",
    levels: "In der App gibt es diesen Text auch kürzer und ausführlicher, passend zum Level.",
    source: "Quelle",
    publisher: "Herausgeber",
    ownWords: "Sapaude fasst die Meldung in eigenen Worten zusammen. Die Quelle steht darunter.",
    more: "Weitere Texte",
    related: "Weitere Meldungen",
    guides: "Ratgeber",
    learn: "KI lernen",
    daily: "Duolingo für KI",
    about: "Über Sapaude",
    privacy: "Datenschutz",
    privacyPath: "privacy/",
    imprint: "Impressum",
    support: "Support",
    aiNote: "Teile der Inhalte werden mit KI erstellt oder unterstützt.",
    indexTitle: "KI-Briefing | Sapaude",
    indexDesc: "Kurze KI-Meldungen und längere Texte von Sapaude, mit Datum und Quelle, auf Deutsch. Der Herausgeber ist Sapaude.",
    indexH1: "KI-Briefing",
    indexLead: "Das KI-Briefing von Sapaude sind kurze Meldungen und längere Texte in eigenen Worten. Jede lange Seite nennt das Datum, die Quelle und die Grenze der Aussage. Herausgeber ist Sapaude. In der App passt das Briefing zum Level.",
    longHeading: "Lange Texte",
    daysHeading: "Kurzmeldungen nach Tag",
    dayCount: "Meldungen",
    older: "Ältere Texte",
    dayTitle: (label) => `Briefing vom ${label} | Sapaude`,
    dayDesc: (label) => `Kurzmeldungen vom ${label} aus dem KI-Briefing von Sapaude, mit Quelle. Die langen Texte sind verlinkt, wo es sie gibt.`,
    dayH1: (label) => `Briefing vom ${label}`,
    dayLead: (label) => `Kurzmeldungen vom ${label}. Sapaude formuliert sie in eigenen Worten. Wo es einen langen Text gibt, führt der Link dorthin. Herausgeber ist Sapaude.`,
    fullText: "Langer Text",
    advanced: "Etwas fachlicher",
    allShort: (label) => `Alle Kurzmeldungen vom ${label}`,
    allLong: "Alle langen Texte",
    moreLabel: "Weitere Texte",
    learnPath: "ki-lernen-app/",
    dailyPath: "duolingo-fuer-ki/",
    aboutPath: "ueber/",
    ogAlt: "Sapaude. Veni, vidi, KI.",
    ogImage: "og-de.png"
  },
  en: {
    lang: "en",
    home: "en/",
    claim: "Be brave. Get smart.",
    skip: "Skip to content",
    contentId: "content",
    other: "Deutsch",
    otherLang: "de",
    briefing: "Briefing",
    homeLabel: "Home",
    published: "Published",
    read: "Reading time",
    minutes: "minutes",
    minute: "minute",
    listen: "Audio in the app",
    listenNote: "Listening to the briefing is part of Sapaude Pro.",
    pointsHeading: "In three points",
    pointsIntro: "Three points, in this order: what the source shows, where that claim stops, and what to check next.",
    takeaway: "What you can do",
    levels: "In the app, the same story is also told shorter and in more detail, matched to your level.",
    source: "Source",
    publisher: "Publisher",
    ownWords: "Sapaude retells the story in its own words. The source is below.",
    more: "More to read",
    related: "More stories",
    guides: "Guides",
    learn: "Learn AI",
    daily: "Duolingo for AI",
    about: "About Sapaude",
    privacy: "Privacy",
    privacyPath: "en/privacy/",
    imprint: "Impressum",
    support: "Support",
    aiNote: "Some content is generated or assisted by AI.",
    indexTitle: "AI briefing | Sapaude",
    indexDesc: "Short AI items and longer articles from Sapaude, with a date and a source, in English. The publisher is Sapaude.",
    indexH1: "AI briefing",
    indexLead: "The Sapaude briefing is short items and longer articles in our own words. Each long page names the date, the source, and the limit of the claim. The publisher is Sapaude. In the app, the briefing matches your level.",
    longHeading: "Long articles",
    daysHeading: "Short items by day",
    dayCount: "items",
    older: "Older articles",
    dayTitle: (label) => `Briefing for ${label} | Sapaude`,
    dayDesc: (label) => `Short briefing items for ${label} from Sapaude, each with its source. Longer articles are linked where they exist.`,
    dayH1: (label) => `Briefing for ${label}`,
    dayLead: (label) => `Short items for ${label}. Sapaude writes them in its own words. Where a longer article exists, the link goes there. The publisher is Sapaude.`,
    fullText: "Long article",
    advanced: "More technical",
    allShort: (label) => `All short items for ${label}`,
    allLong: "All long articles",
    moreLabel: "More to read",
    learnPath: "en/best-app-to-learn-ai/",
    dailyPath: "en/duolingo-for-ai/",
    aboutPath: "en/about/",
    ogAlt: "Sapaude. Be brave. Get smart.",
    ogImage: "og.png"
  }
};

const STATIC_URLS = [
  ["/", null],
  ["/en/", null],
  ["/ki-lernen-app/", "2026-11-14"],
  ["/duolingo-fuer-ki/", "2026-11-14"],
  ["/en/best-app-to-learn-ai/", "2026-11-14"],
  ["/en/duolingo-for-ai/", "2026-11-14"],
  ["/ueber/", "2026-11-14"],
  ["/en/about/", "2026-11-14"],
  ["/privacy/", "2026-10-26"],
  ["/en/privacy/", "2026-10-26"],
  ["/daten-loeschen/", "2026-10-26"],
  ["/en/delete-data/", "2026-10-26"],
  ["/impressum/", "2026-10-22"],
  ["/nutzungsbedingungen/", "2026-10-22"],
  ["/en/terms/", "2026-10-22"],
  ["/support/", "2026-11-14"],
  ["/en/support/", "2026-11-14"]
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clip(text, max = 160) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  let cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  if (space >= 80) cut = cut.slice(0, space);
  cut = cut.replace(/[.,;:–—-]+$/g, "").trim();
  return `${cut}…`;
}

function formatDay(iso, locale) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return iso || "";
  const month = MONTHS[locale][Number(match[2]) - 1];
  const day = Number(match[3]);
  if (locale === "de") return `${day}. ${month} ${match[1]}`;
  return `${day} ${month} ${match[1]}`;
}

function minutesLabel(count, copy) {
  const n = Number(count);
  const unit = n === 1 ? copy.minute : copy.minutes;
  return `${n} ${unit}`;
}

function slugFromPulseId(id) {
  return String(id).replace(/^pulse-/, "");
}

function articlePaths(slug) {
  return {
    de: `briefing/${slug}/`,
    en: `en/briefing/${slug}/`
  };
}

function relFile(fromFile, urlPath) {
  const fromDir = path.posix.dirname(fromFile);
  const target = path.posix.join("docs", urlPath);
  const rel = path.posix.relative(fromDir, target);
  return rel || ".";
}

function relHref(fromFile, urlPath) {
  const href = relFile(fromFile, urlPath);
  if (!href || href === ".") return "./";
  return href.endsWith("/") ? href : `${href}/`;
}

function jsonScript(data) {
  const json = JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">\n${json}\n  </script>`;
}

function publisherNode() {
  return {
    "@type": "Organization",
    name: "Sapaude",
    url: `${ORIGIN}/`,
    logo: {
      "@type": "ImageObject",
      url: `${ORIGIN}/logo-512.png`,
      width: 512,
      height: 512
    }
  };
}

function renderInline(escaped) {
  return escaped
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, (_all, label, href) => {
      return `<a href="${href}">${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderMarkdown(markdown) {
  const source = String(markdown || "").replace(/\r\n/g, "\n").trim();
  if (!source) return "";
  return source.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return "";
    if (lines.every((line) => line.startsWith("## "))) {
      return lines.map((line) => `<h2>${renderInline(escapeHtml(line.slice(3).trim()))}</h2>`).join("\n");
    }
    return `<p>${renderInline(escapeHtml(lines.join(" ")))}</p>`;
  }).filter(Boolean).join("\n");
}

function textOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function httpsUrl(value) {
  const raw = textOrEmpty(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function copyForBriefing(item, locale) {
  const de = item && item.i18n && item.i18n.de;
  if (locale === "de" && de && textOrEmpty(de.headline) && textOrEmpty(de.summary)) {
    return { headline: de.headline.trim(), summary: de.summary.trim() };
  }
  return {
    headline: textOrEmpty(item && item.headline),
    summary: textOrEmpty(item && item.summary)
  };
}

function plainEnough(item, locale) {
  if (textOrEmpty(item && item.level) === "advanced") return false;
  const copy = copyForBriefing(item, locale);
  return !JARGON.test(`${copy.headline} ${copy.summary}`);
}

export function pickBriefing(day, locale) {
  if (!day || !Array.isArray(day.items)) return [];
  return day.items.filter((item) => plainEnough(item, locale)).slice(0, 3);
}

function pulseCopy(item, locale) {
  if (locale === "de" && item.i18n && item.i18n.de) return item.i18n.de;
  return item;
}

function sortPulse(items) {
  return items.map((item, index) => ({ item, index })).sort((a, b) => {
    const byDate = String(b.item.date).localeCompare(String(a.item.date));
    if (byDate !== 0) return byDate;
    return a.index - b.index;
  }).map((entry) => entry.item);
}

function relatedItems(item, items) {
  const others = items.filter((other) => other.id !== item.id);
  const same = others.filter((other) => other.tag === item.tag);
  const rest = others.filter((other) => other.tag !== item.tag);
  return [...same, ...rest].slice(0, 3);
}

function breadcrumbLd(crumbs) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url
    }))
  };
}

function pageShell({ file, locale, title, description, canonical, deUrl, enUrl, body, jsonLd, ogType = "article" }) {
  const copy = COPY[locale];
  const otherUrl = locale === "de" ? enUrl : deUrl;
  const homeUrl = COPY[locale].home;
  const asset = (name) => relFile(file, name);
  const href = (urlPath) => relHref(file, urlPath);
  const xDefault = deUrl;
  const safeDescription = clip(description);
  return `<!DOCTYPE html>
<html lang="${copy.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(safeDescription)}">
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="de" href="${deUrl}">
  <link rel="alternate" hreflang="en" href="${enUrl}">
  <link rel="alternate" hreflang="x-default" href="${xDefault}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="Sapaude">
  <meta property="og:locale" content="${locale === "de" ? "de_DE" : "en_GB"}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(safeDescription)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${ORIGIN}/${copy.ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(copy.ogAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(safeDescription)}">
  <meta name="twitter:image" content="${ORIGIN}/${copy.ogImage}">
  <meta name="twitter:image:alt" content="${escapeHtml(copy.ogAlt)}">
  <meta name="theme-color" content="#F6F1E8">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <link rel="icon" href="${asset("favicon.svg")}" type="image/svg+xml">
  <link rel="icon" href="${asset("favicon-32.png")}" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="${asset("apple-touch-icon.png")}">
  <link rel="preload" href="${asset("assets/fraunces-latin-500.woff2")}" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="${asset("assets/source-sans-3-latin-400.woff2")}" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${asset("styles.css")}">
  ${jsonLd}
</head>
<body>
  <a class="skip" href="#${copy.contentId}">${copy.skip}</a>
  <div class="wrap">
    <header class="site-header">
      <a class="brand" href="${href(homeUrl)}" aria-label="sapaude.">sapaude<span class="brand-dot" aria-hidden="true"></span></a>
      <nav class="site-nav" aria-label="Sapaude">
        <a href="${href(locale === "de" ? "briefing/" : "en/briefing/")}">${copy.briefing}</a>
        <a href="${href(otherUrl.replace(`${ORIGIN}/`, ""))}" hreflang="${copy.otherLang}" lang="${copy.otherLang}">${copy.other}</a>
        <a href="${href(homeUrl)}">${copy.homeLabel}</a>
      </nav>
    </header>
    <main id="${copy.contentId}">
${body}
    </main>
    <footer>
      <p class="claim">${escapeHtml(copy.claim)}</p>
      <p>${escapeHtml(copy.publisher)}: Sapaude. ${escapeHtml(copy.aiNote)}</p>
      <a href="${href(homeUrl)}">${copy.homeLabel}</a>
      ·
      <a href="${href(locale === "de" ? "briefing/" : "en/briefing/")}">${copy.briefing}</a>
      ·
      <a href="${href(copy.learnPath)}">${copy.learn}</a>
      ·
      <a href="${href(copy.dailyPath)}">${copy.daily}</a>
      ·
      <a href="${href(copy.aboutPath)}">${copy.about}</a>
      ·
      <a href="${href(copy.privacyPath)}">${copy.privacy}</a>
      ·
      <a href="${href("impressum/")}">${copy.imprint}</a>
      ·
      <a href="mailto:support@sapaude.app">support@sapaude.app</a>
    </footer>
  </div>
</body>
</html>
`;
}

function articlePage(item, locale, items) {
  const copy = COPY[locale];
  const text = pulseCopy(item, locale);
  const slug = slugFromPulseId(item.id);
  const paths = articlePaths(slug);
  const file = `docs/${paths[locale]}index.html`;
  const canonical = `${ORIGIN}/${paths[locale]}`;
  const deUrl = `${ORIGIN}/${paths.de}`;
  const enUrl = `${ORIGIN}/${paths.en}`;
  const published = String(item.date).slice(0, 10);
  const label = formatDay(published, locale);
  const headline = textOrEmpty(text.headline);
  const hook = textOrEmpty(text.hook);
  const description = clip(hook);
  const title = `${headline} | Sapaude`;
  const tag = TAG_LABEL[locale][item.tag] || item.tag;
  const sourceName = textOrEmpty(item.source && item.source.name);
  const sourceUrl = httpsUrl(item.source && item.source.url);
  const points = Array.isArray(text.summaryPoints) ? text.summaryPoints : [];
  const takeaway = textOrEmpty(text.takeaway);
  const hasLevels = Boolean(item.levels && (item.levels.beginner || item.levels.advanced));
  const related = relatedItems(item, items);
  const crumbs = [
    { name: copy.homeLabel, url: `${ORIGIN}/${copy.home}` },
    { name: copy.briefing, url: `${ORIGIN}/${locale === "de" ? "briefing/" : "en/briefing/"}` },
    { name: headline, url: canonical }
  ];
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${canonical}#article`,
        headline,
        description,
        datePublished: published,
        dateModified: published,
        inLanguage: locale,
        mainEntityOfPage: canonical,
        author: publisherNode(),
        publisher: publisherNode(),
        citation: sourceUrl,
        isBasedOn: sourceUrl
      },
      breadcrumbLd(crumbs)
    ]
  };
  const pointHtml = points.map((point) => `        <li>${escapeHtml(point)}</li>`).join("\n");
  const relatedHtml = related.map((other) => {
    const otherText = pulseCopy(other, locale);
    const otherSlug = slugFromPulseId(other.id);
    const otherPath = articlePaths(otherSlug)[locale];
    return `        <li><a href="${relHref(file, otherPath)}">${escapeHtml(textOrEmpty(otherText.headline))}</a></li>`;
  }).join("\n");
  const sourceHtml = sourceUrl
    ? `<a href="${escapeHtml(sourceUrl)}">${escapeHtml(sourceName)}</a>`
    : escapeHtml(sourceName);
  const body = `      <p class="meta"><a href="${relHref(file, copy.home)}">Sapaude</a> · <a href="${relHref(file, locale === "de" ? "briefing/" : "en/briefing/")}">${copy.briefing}</a></p>
      <p class="kicker">${escapeHtml(tag)}</p>
      <h1>${escapeHtml(headline)}</h1>
      <p class="meta"><time datetime="${published}">${escapeHtml(label)}</time> · ${copy.read}: ${minutesLabel(item.readTimeMinutes, copy)} · ${copy.listen}: ${minutesLabel(item.listenTimeMinutes, copy)}. ${escapeHtml(copy.listenNote)}</p>
      <p>${escapeHtml(hook)}</p>
      <p>${escapeHtml(copy.ownWords)} ${copy.publisher}: Sapaude.</p>
      <h2>${escapeHtml(copy.pointsHeading)}</h2>
      <p>${escapeHtml(copy.pointsIntro)}</p>
      <ol>
${pointHtml}
      </ol>
      ${renderMarkdown(text.deepDiveMarkdown).split("\n").map((line) => `      ${line}`).join("\n")}
      ${takeaway ? `<h2>${escapeHtml(copy.takeaway)}</h2>\n      ${renderMarkdown(takeaway).split("\n").map((line) => `      ${line}`).join("\n")}` : ""}
      ${hasLevels ? `<p>${escapeHtml(copy.levels)}</p>` : ""}
      <p class="article-source">${copy.source}: ${sourceHtml}. ${copy.published}: <time datetime="${published}">${escapeHtml(label)}</time>.</p>
      <h2>${escapeHtml(copy.related)}</h2>
      <ul>
${relatedHtml}
      </ul>
      <p><a href="${relHref(file, copy.learnPath)}">${copy.learn}</a> · <a href="${relHref(file, copy.dailyPath)}">${copy.daily}</a></p>`;
  return {
    file,
    url: `/${paths[locale]}`,
    lastmod: published,
    html: `<!-- generated by scripts/render-pages.mjs; do not edit by hand -->\n${pageShell({
      file,
      locale,
      title,
      description,
      canonical,
      deUrl,
      enUrl,
      body,
      jsonLd: jsonScript(ld)
    })}`
  };
}

function dayPage(day, locale, pulseById) {
  const copy = COPY[locale];
  const urlPath = `${locale === "de" ? "briefing" : "en/briefing"}/tag/${day.date}/`;
  const file = `docs/${urlPath}index.html`;
  const canonical = `${ORIGIN}/${urlPath}`;
  const deUrl = `${ORIGIN}/briefing/tag/${day.date}/`;
  const enUrl = `${ORIGIN}/en/briefing/tag/${day.date}/`;
  const label = formatDay(day.date, locale);
  const itemsHtml = day.items.map((item) => {
    const text = copyForBriefing(item, locale);
    const tag = TAG_LABEL[locale][item.tag] || item.tag || "";
    const sourceName = textOrEmpty(item.source && item.source.name);
    const sourceUrl = httpsUrl(item.source && item.source.url);
    const pulse = item.pulseId && pulseById.get(item.pulseId);
    const advanced = textOrEmpty(item.level) === "advanced" ? ` · ${copy.advanced}` : "";
    const source = sourceUrl
      ? `<a href="${escapeHtml(sourceUrl)}">${escapeHtml(sourceName)}</a>`
      : escapeHtml(sourceName);
    const deep = pulse
      ? `<p><a href="${relHref(file, articlePaths(slugFromPulseId(pulse.id))[locale])}">${copy.fullText}</a></p>`
      : "";
    return `      <article>
        <p class="kicker">${escapeHtml(tag)}${advanced}</p>
        <h2>${escapeHtml(text.headline)}</h2>
        <p>${escapeHtml(text.summary)}</p>
        <p class="article-source">${copy.source}: ${source}</p>
        ${deep}
      </article>`;
  }).join("\n");
  const list = day.items.map((item, index) => {
    const text = copyForBriefing(item, locale);
    const entry = {
      "@type": "ListItem",
      position: index + 1,
      name: text.headline
    };
    const pulse = item.pulseId && pulseById.get(item.pulseId);
    if (pulse) entry.url = `${ORIGIN}/${articlePaths(slugFromPulseId(pulse.id))[locale]}`;
    return entry;
  });
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#page`,
        name: copy.dayH1(label),
        description: copy.dayDesc(label),
        datePublished: day.date,
        inLanguage: locale,
        url: canonical,
        publisher: publisherNode(),
        mainEntity: {
          "@type": "ItemList",
          itemListElement: list
        }
      },
      breadcrumbLd([
        { name: copy.homeLabel, url: `${ORIGIN}/${copy.home}` },
        { name: copy.briefing, url: `${ORIGIN}/${locale === "de" ? "briefing/" : "en/briefing/"}` },
        { name: label, url: canonical }
      ])
    ]
  };
  const body = `      <p class="meta"><a href="${relHref(file, copy.home)}">Sapaude</a> · <a href="${relHref(file, locale === "de" ? "briefing/" : "en/briefing/")}">${copy.briefing}</a></p>
      <h1>${escapeHtml(copy.dayH1(label))}</h1>
      <p>${escapeHtml(copy.dayLead(label))}</p>
${itemsHtml}`;
  return {
    file,
    url: `/${urlPath}`,
    lastmod: day.date,
    html: `<!-- generated by scripts/render-pages.mjs; do not edit by hand -->\n${pageShell({
      file,
      locale,
      title: copy.dayTitle(label),
      description: clip(copy.dayDesc(label)),
      canonical,
      deUrl,
      enUrl,
      body,
      jsonLd: jsonScript(ld),
      ogType: "website"
    })}`
  };
}

function indexPage(items, days, locale, kept) {
  const copy = COPY[locale];
  const urlPath = locale === "de" ? "briefing/" : "en/briefing/";
  const file = `docs/${urlPath}index.html`;
  const canonical = `${ORIGIN}/${urlPath}`;
  const deUrl = `${ORIGIN}/briefing/`;
  const enUrl = `${ORIGIN}/en/briefing/`;
  const articles = items.map((item) => {
    const text = pulseCopy(item, locale);
    const slug = slugFromPulseId(item.id);
    const published = String(item.date).slice(0, 10);
    return `      <li>
        <p class="meta"><time datetime="${published}">${escapeHtml(formatDay(published, locale))}</time> · ${escapeHtml(TAG_LABEL[locale][item.tag] || item.tag)}</p>
        <h2><a href="${relHref(file, articlePaths(slug)[locale])}">${escapeHtml(textOrEmpty(text.headline))}</a></h2>
        <p>${escapeHtml(textOrEmpty(text.hook))}</p>
      </li>`;
  }).join("\n");
  const dayLinks = days.map((day) => {
    const url = `${locale === "de" ? "briefing" : "en/briefing"}/tag/${day.date}/`;
    return `      <li><a href="${relHref(file, url)}"><time datetime="${day.date}">${escapeHtml(formatDay(day.date, locale))}</time></a> · ${day.items.length} ${copy.dayCount}</li>`;
  }).join("\n");
  const older = kept.length
    ? `      <h2>${escapeHtml(copy.older)}</h2>
      <ul>
${kept.map((entry) => `        <li><a href="${relHref(file, entry.urlPath)}">${escapeHtml(entry.title)}</a></li>`).join("\n")}
      </ul>`
    : "";
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#page`,
        name: copy.indexH1,
        description: copy.indexDesc,
        inLanguage: locale,
        url: canonical,
        publisher: publisherNode(),
        mainEntity: {
          "@type": "ItemList",
          itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: textOrEmpty(pulseCopy(item, locale).headline),
            url: `${ORIGIN}/${articlePaths(slugFromPulseId(item.id))[locale]}`
          }))
        }
      },
      breadcrumbLd([
        { name: copy.homeLabel, url: `${ORIGIN}/${copy.home}` },
        { name: copy.briefing, url: canonical }
      ])
    ]
  };
  const body = `      <p class="meta"><a href="${relHref(file, copy.home)}">Sapaude</a></p>
      <h1>${escapeHtml(copy.indexH1)}</h1>
      <p>${escapeHtml(copy.indexLead)} ${escapeHtml(copy.listenNote)}</p>
      <p><a href="${relHref(file, copy.learnPath)}">${copy.learn}</a> · <a href="${relHref(file, copy.dailyPath)}">${copy.daily}</a></p>
      <h2>${escapeHtml(copy.longHeading)}</h2>
      <ul>
${articles}
      </ul>
      <h2>${escapeHtml(copy.daysHeading)}</h2>
      <ul>
${dayLinks}
      </ul>
${older}`;
  const newest = items[0] ? String(items[0].date).slice(0, 10) : days[0]?.date;
  return {
    file,
    url: `/${urlPath}`,
    lastmod: newest,
    html: `<!-- generated by scripts/render-pages.mjs; do not edit by hand -->\n${pageShell({
      file,
      locale,
      title: copy.indexTitle,
      description: copy.indexDesc,
      canonical,
      deUrl,
      enUrl,
      body,
      jsonLd: jsonScript(ld),
      ogType: "website"
    })}`
  };
}

function renderBriefingCards(day, locale) {
  const picked = pickBriefing(day, locale);
  if (picked.length < 3) {
    throw new Error(`Need 3 plain briefing items for ${locale}, found ${picked.length}`);
  }
  return picked.map((item) => {
    const text = copyForBriefing(item, locale);
    const tag = textOrEmpty(item.tag);
    const label = (tag && TAG_LABEL[locale][tag]) || tag;
    const sourceName = textOrEmpty(item.source && item.source.name);
    const sourceUrl = httpsUrl(item.source && item.source.url);
    const meta = label ? `          <p class="item-meta">${escapeHtml(label)}</p>\n` : "";
    const source = sourceName
      ? `\n          <p class="item-source">${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}">${escapeHtml(sourceName)}</a>` : escapeHtml(sourceName)}</p>`
      : "";
    return `        <li class="brief-item">
${meta}          <h3>${escapeHtml(text.headline)}</h3>
          <p>${escapeHtml(text.summary)}</p>${source}
        </li>`;
  }).join("\n");
}

function renderMore(day, items, locale) {
  const copy = COPY[locale];
  const label = formatDay(day.date, locale);
  const top = items.slice(0, 4).map((item) => {
    const text = pulseCopy(item, locale);
    const slug = slugFromPulseId(item.id);
    return `        <li><a href="briefing/${slug}/">${escapeHtml(textOrEmpty(text.headline))}</a></li>`;
  }).join("\n");
  const learn = locale === "de" ? "ki-lernen-app/" : "best-app-to-learn-ai/";
  const daily = locale === "de" ? "duolingo-fuer-ki/" : "duolingo-for-ai/";
  return `      <nav class="brief-more" aria-label="${escapeHtml(copy.moreLabel)}">
        <p class="prose"><a href="briefing/tag/${day.date}/">${escapeHtml(copy.allShort(label))}</a></p>
        <ul>
${top}
        </ul>
        <p class="prose"><a href="briefing/">${escapeHtml(copy.allLong)}</a> · <a href="${learn}">${escapeHtml(copy.learn)}</a> · <a href="${daily}">${escapeHtml(copy.daily)}</a></p>
      </nav>`;
}

function fillMarked(html, name, inner, indent) {
  const start = `<!-- ${name} -->`;
  const end = `<!-- /${name} -->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!pattern.test(html)) throw new Error(`Missing marker ${name}`);
  return html.replace(pattern, `${start}\n${inner}\n${indent}${end}`);
}

function patchHome(html, day, items, locale) {
  const label = formatDay(day.date, locale);
  const next = html.replace(
    /<time data-briefing-date datetime="[^"]*">[^<]*<\/time>/,
    `<time data-briefing-date datetime="${day.date}">${label}</time>`
  );
  const withCards = fillMarked(next, "briefing:cards", renderBriefingCards(day, locale), "        ");
  return fillMarked(withCards, "briefing:more", renderMore(day, items, locale), "      ");
}

function sitemapXml(entries) {
  const seen = new Set();
  const urls = [];
  for (const entry of entries) {
    if (!entry || seen.has(entry.loc)) continue;
    seen.add(entry.loc);
    urls.push(entry);
  }
  const body = urls.map((entry) => `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${entry.lastmod}</lastmod>
  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function keptPages(docsDir, locale, currentUrls) {
  const folder = locale === "de" ? "briefing" : path.join("en", "briefing");
  const base = path.join(docsDir, folder);
  if (!existsSync(base)) return [];
  const kept = [];
  for (const name of readdirSync(base)) {
    if (name === "tag" || name === "index.html") continue;
    const dir = path.join(base, name);
    if (!statSync(dir).isDirectory()) continue;
    const urlPath = `${locale === "de" ? "briefing" : "en/briefing"}/${name}/`;
    if (currentUrls.has(`/${urlPath}`)) continue;
    const file = path.join(dir, "index.html");
    if (!existsSync(file)) continue;
    const html = readFileSync(file, "utf8");
    if (!html.includes("generated by scripts/render-pages.mjs")) continue;
    const title = (html.match(/<h1>([^<]*)<\/h1>/) || [])[1] || name;
    const lastmod = (html.match(/<time datetime="(\d{4}-\d{2}-\d{2})"/) || [])[1] || name.slice(0, 10);
    kept.push({ urlPath, title, lastmod });
  }
  const tagDir = path.join(base, "tag");
  if (existsSync(tagDir)) {
    for (const name of readdirSync(tagDir)) {
      const urlPath = `${locale === "de" ? "briefing" : "en/briefing"}/tag/${name}/`;
      if (currentUrls.has(`/${urlPath}`)) continue;
      const file = path.join(tagDir, name, "index.html");
      if (!existsSync(file)) continue;
      const html = readFileSync(file, "utf8");
      if (!html.includes("generated by scripts/render-pages.mjs")) continue;
      kept.push({
        urlPath,
        title: formatDay(name, locale),
        lastmod: name,
        day: true
      });
    }
  }
  return kept;
}

export function buildSite(rootDir) {
  const pulse = JSON.parse(readFileSync(path.join(rootDir, "pulse.json"), "utf8"));
  const briefing = JSON.parse(readFileSync(path.join(rootDir, "briefing.json"), "utf8"));
  const items = sortPulse(pulse);
  const days = briefing.days;
  const pulseById = new Map(pulse.map((item) => [item.id, item]));
  const files = new Map();
  const generated = [];

  for (const locale of ["de", "en"]) {
    for (const item of items) {
      const page = articlePage(item, locale, items);
      files.set(page.file, page.html);
      generated.push(page);
    }
    for (const day of days) {
      const page = dayPage(day, locale, pulseById);
      files.set(page.file, page.html);
      generated.push(page);
    }
  }

  const currentUrls = new Set(generated.map((page) => page.url));
  for (const locale of ["de", "en"]) {
    const kept = keptPages(path.join(rootDir, "docs"), locale, currentUrls).filter((entry) => !entry.day);
    const page = indexPage(items, days, locale, kept);
    files.set(page.file, page.html);
    generated.push(page);
    for (const entry of keptPages(path.join(rootDir, "docs"), locale, currentUrls)) {
      if (entry.day) {
        generated.push({ url: `/${entry.urlPath}`, lastmod: entry.lastmod });
      } else {
        generated.push({ url: `/${entry.urlPath}`, lastmod: entry.lastmod });
      }
    }
  }

  const homeDate = String(briefing.updatedAt).slice(0, 10);
  const deHome = patchHome(readFileSync(path.join(rootDir, "docs/index.html"), "utf8"), days[0], items, "de");
  const enHome = patchHome(readFileSync(path.join(rootDir, "docs/en/index.html"), "utf8"), days[0], items, "en");
  files.set("docs/index.html", deHome);
  files.set("docs/en/index.html", enHome);

  const entries = STATIC_URLS.map(([loc, lastmod]) => ({
    loc: `${ORIGIN}${loc}`,
    lastmod: lastmod || homeDate
  }));
  for (const page of generated) {
    entries.push({ loc: `${ORIGIN}${page.url}`, lastmod: page.lastmod });
  }
  files.set("docs/sitemap.xml", sitemapXml(entries));
  return files;
}

function writeSite(rootDir, files) {
  for (const [rel, html] of files) {
    if (rel.endsWith("pulse.json") || rel.endsWith("briefing.json")) {
      throw new Error(`Refusing to write feed ${rel}`);
    }
    const full = path.join(rootDir, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, html);
  }
}

function diffSite(rootDir, files) {
  const mismatches = [];
  for (const [rel, html] of files) {
    const full = path.join(rootDir, rel);
    if (!existsSync(full) || readFileSync(full, "utf8") !== html) mismatches.push(rel);
  }
  return mismatches;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

function main() {
  const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const files = buildSite(rootDir);
  const check = process.argv.includes("--check");
  if (check) {
    const mismatches = diffSite(rootDir, files);
    if (mismatches.length) {
      console.error(`Rendered pages are stale (${mismatches.length}). Run: node scripts/render-pages.mjs`);
      for (const rel of mismatches) console.error(`  ${rel}`);
      process.exit(1);
    }
    console.log(`Rendered pages match (${files.size} files).`);
    return;
  }
  writeSite(rootDir, files);
  console.log(`Wrote ${files.size} files.`);
}

if (isDirectRun()) main();
