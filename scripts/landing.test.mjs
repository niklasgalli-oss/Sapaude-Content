import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, found);
    else found.push(path);
  }
  return found;
}

test("custom domain is sapaude.app", () => {
  assert.equal(existsSync(join(root, "CNAME")), false);
  assert.equal(read("docs/CNAME").trim(), "sapaude.app");
  assert.equal(existsSync(join(root, "docs/landing-domain.md")), false);
  const doc = read("ops/landing-domain.md");
  assert.match(doc, /185\.199\.108\.153/);
  assert.match(doc, /185\.199\.111\.153/);
  assert.match(doc, /2606:50c0:8000::153/);
  assert.match(doc, /2606:50c0:8003::153/);
  assert.match(doc, /niklasgalli-oss\.github\.io/);
  assert.match(doc, /Enforce HTTPS/);
  assert.match(doc, /HSTS/);
  assert.match(doc, /MX/);
  assert.match(doc, /apple-app-site-association/);
  assert.match(read("docs/index.html"), /rel="canonical" href="https:\/\/sapaude\.app\/"/);
  assert.match(read("docs/index.html"), /property="og:url" content="https:\/\/sapaude\.app\/"/);
  assert.match(read("docs/en/index.html"), /rel="canonical" href="https:\/\/sapaude\.app\/en\/"/);
  assert.match(read("docs/en/index.html"), /property="og:url" content="https:\/\/sapaude\.app\/en\/"/);
  assert.match(read("docs/de/index.html"), /rel="canonical" href="https:\/\/sapaude\.app\/"/);
  assert.match(read("docs/de/index.html"), /http-equiv="refresh" content="0; url=\/"/);
  assert.match(read("docs/sitemap.xml"), /<loc>https:\/\/sapaude\.app\/<\/loc>/);
  assert.match(read("docs/sitemap.xml"), /<loc>https:\/\/sapaude\.app\/en\/<\/loc>/);
  assert.doesNotMatch(read("docs/sitemap.xml"), /<loc>https:\/\/sapaude\.app\/de\//);
  for (const path of [
    "docs/index.html",
    "docs/en/index.html",
    "docs/de/index.html",
    "docs/sitemap.xml",
    "docs/robots.txt",
    "docs/privacy/index.html",
    "docs/en/privacy/index.html",
    "docs/impressum/index.html"
  ]) {
    assert.doesNotMatch(read(path), /github\.io\/(?:AILA|Sapaude)-Content/);
    assert.doesNotMatch(read(path), /sapaude\.de/);
  }
  for (const path of walk(join(root, "docs")).filter((item) => /\.(html|css|js)$/.test(item))) {
    const rel = path.slice(root.length + 1);
    assert.doesNotMatch(read(rel), /sapaude\.de/, rel);
    assert.doesNotMatch(read(rel), /http:\/\//, rel);
  }
  assert.doesNotMatch(doc, /sapaude\.de/);
  assert.doesNotMatch(read("README.md"), /sapaude\.de/);
});

test("repository path is Sapaude-Content", () => {
  const allowed = new Set(["scripts/landing.test.mjs"]);
  const hits = [];
  for (const path of walk(root)) {
    const rel = path.slice(root.length + 1);
    if (!/\.(md|mjs|js|json|yml|yaml|html|txt|xml|css)$/.test(rel)) continue;
    if (allowed.has(rel)) continue;
    if (read(rel).includes("AILA-Content")) hits.push(rel);
  }
  assert.deepEqual(hits, []);
  const readme = read("README.md");
  assert.match(readme, /niklasgalli-oss\/Sapaude-Content\/main\/pulse\.json/);
  assert.match(readme, /niklasgalli-oss\/Sapaude-Content\/main\/briefing\.json/);
  assert.match(read("ops/landing-domain.md"), /github\.io\/Sapaude-Content\/privacy\//);
  assert.match(read("schema/pulse.schema.json"), /Sapaude-Content\/main\/schema\/pulse\.schema\.json/);
  assert.match(read("schema/briefing.schema.json"), /Sapaude-Content\/main\/schema\/briefing\.schema\.json/);
  assert.match(read("scripts/validate.mjs"), /Sapaude-Content-validator\/1\.0 \(\+https:\/\/github\.com\/niklasgalli-oss\/Sapaude-Content\)/);
  assert.equal(read("docs/CNAME").trim(), "sapaude.app");
  assert.doesNotMatch(read(".github/workflows/validate-pulse.yml"), /AILA-Content/);
});

test("published feeds match the repo root", () => {
  assert.equal(
    read("docs/pulse.json") === read("pulse.json"),
    true,
    "docs/pulse.json must stay a byte copy of pulse.json"
  );
  assert.equal(
    read("docs/briefing.json") === read("briefing.json"),
    true,
    "docs/briefing.json must stay a byte copy of briefing.json"
  );
});

test("apple-app-site-association is not a file", () => {
  const paths = walk(root).map((path) => path.slice(root.length + 1));
  const hit = paths.filter((path) => path.includes("apple-app-site-association"));
  assert.deepEqual(hit, []);
});

test("App Store URL is one empty constant", () => {
  const js = read("docs/landing.js");
  assert.match(js, /const SAPAUDE_APP_STORE_URL = "";/);
  assert.equal((js.match(/const SAPAUDE_APP_STORE_URL/g) || []).length, 1);
  assert.match(js, /const SAPAUDE_BRIEFING_URL = "https:\/\/sapaude\.app\/briefing\.json"/);
  assert.doesNotMatch(js, /AILA_/);
});

test("English and German pages carry the landing sections", () => {
  const de = read("docs/index.html");
  const en = read("docs/en/index.html");
  for (const html of [en, de]) {
    assert.match(html, /rel="alternate" hreflang="en" href="https:\/\/sapaude\.app\/en\/"/);
    assert.match(html, /rel="alternate" hreflang="de" href="https:\/\/sapaude\.app\/"/);
    assert.match(html, /rel="alternate" hreflang="x-default" href="https:\/\/sapaude\.app\/"/);
    assert.match(html, /og:image/);
    assert.match(html, /Sapaude for Teams/);
    assert.match(html, /support@sapaude\.app/);
    assert.doesNotMatch(html, /niklas\.galli@sapaude\.app/);
    assert.doesNotMatch(html, /Niklas Galli/);
    assert.doesNotMatch(html, /Neuburger/);
    assert.doesNotMatch(html, /Karlshuld/);
    assert.match(html, /data-briefing-list/);
    assert.equal((html.match(/class="brief-item"/g) || []).length, 3);
    assert.equal((html.match(/class="level /g) || []).length, 3);
    assert.doesNotMatch(html, /fonts\.googleapis\.com/);
    assert.doesNotMatch(html, /googletagmanager|google-analytics|plausible|cdn\.jsdelivr/i);
  }
  assert.match(en, /Coming soon on App Store/);
  assert.match(en, /Coming soon on Google Play/);
  assert.match(en, /Learn AI/);
  assert.match(en, /Android follows/);
  assert.match(de, /Demnächst im App Store/);
  assert.match(de, /Demnächst bei Google Play/);
  assert.match(de, /Android folgt/);
  assert.match(de, /KI lernen/);
  assert.match(en, /<html lang="en">/);
  assert.match(de, /<html lang="de">/);
  assert.match(en, /href="\.\.\/" hreflang="de"/);
  assert.match(de, /href="en\/" hreflang="en"/);
  assert.match(en, /href="\.\.\/impressum\/"/);
  assert.match(en, /href="privacy\/"/);
  assert.match(en, /href="terms\/"/);
  assert.doesNotMatch(en, /privacy\/en\//);
  assert.match(de, /href="impressum\/"/);
  assert.match(de, /href="privacy\/"/);
  assert.match(de, /href="nutzungsbedingungen\/"/);
});

test("landing assets stay self-hosted and flat-colored", () => {
  const css = read("docs/landing.css");
  assert.match(css, /fraunces-latin-600\.woff2/);
  assert.match(css, /source-sans-3-latin-400\.woff2/);
  const cssNoMask = css.replace(/-webkit-mask-image:[^;]*;|mask-image:[^;]*;/g, "");
  assert.doesNotMatch(cssNoMask, /linear-gradient|radial-gradient|fonts\.googleapis/i);
  assert.match(css, /mask-image:/);
  assert.doesNotMatch(css, /fraunces-latin-400|fraunces-latin-700|source-sans-3-latin-700/);
  assert.equal(existsSync(join(root, "docs/assets/fraunces-latin-600.woff2")), true);
  assert.equal(existsSync(join(root, "docs/assets/sapaude-head-full.webp")), true);
  for (const pose of ["idle", "blink", "think", "cheer", "present"]) {
    assert.equal(existsSync(join(root, `docs/assets/sapaude-book/${pose}.webp`)), true);
  }
  assert.match(css, /@keyframes sapaude-bob/);
  assert.match(css, /@keyframes sapaude-blink/);
  const en = read("docs/en/index.html");
  const de = read("docs/index.html");
  assert.match(en, /assets\/sapaude-book\/idle\.webp/);
  assert.match(de, /assets\/sapaude-book\/idle\.webp/);
  assert.doesNotMatch(en, /sapaude-head-full/);
  assert.doesNotMatch(de, /sapaude-head-full/);
  assert.equal(existsSync(join(root, "docs/assets/source-sans-3-latin-400.woff2")), true);
  assert.equal(existsSync(join(root, "docs/assets/OFL.txt")), true);
  for (const locale of ["de", "en"]) {
    for (const name of ["activity", "basics", "briefing", "home", "reader"]) {
      for (const width of ["390", "780"]) {
        for (const ext of ["webp", "avif"]) {
          assert.equal(existsSync(join(root, `docs/assets/screens/${locale}/${name}-${width}.${ext}`)), true);
        }
      }
    }
  }
  assert.equal(existsSync(join(root, "docs/assets/app-store-badge-en.svg")), true);
  assert.equal(existsSync(join(root, "docs/assets/app-store-badge-de.svg")), true);
  assert.equal(existsSync(join(root, "docs/og.png")), true);
  assert.equal(existsSync(join(root, "docs/og-de.png")), true);
  assert.equal(existsSync(join(root, "docs/favicon.svg")), true);
  assert.equal(existsSync(join(root, "docs/robots.txt")), true);
  assert.equal(existsSync(join(root, "docs/sitemap.xml")), true);
  const robots = read("docs/robots.txt");
  const sitemap = read("docs/sitemap.xml");
  assert.match(robots, /sitemap\.xml/);
  assert.match(sitemap, /https:\/\/sapaude\.app\/en\//);
  assert.match(sitemap, /https:\/\/sapaude\.app\/privacy\//);
  assert.match(sitemap, /https:\/\/sapaude\.app\/en\/privacy\//);
  assert.match(sitemap, /https:\/\/sapaude\.app\/impressum\//);
  assert.match(sitemap, /https:\/\/sapaude\.app\/nutzungsbedingungen\//);
  assert.match(sitemap, /https:\/\/sapaude\.app\/en\/terms\//);
  assert.doesNotMatch(sitemap, /https:\/\/sapaude\.app\/de\//);
  assert.doesNotMatch(sitemap, /https:\/\/sapaude\.app\/privacy\/en\//);
  assert.doesNotMatch(sitemap, /https:\/\/sapaude\.app\/terms\//);
});

test("name and address stay on the imprint only", () => {
  const publicPages = [
    "docs/index.html",
    "docs/en/index.html",
    "docs/privacy/index.html",
    "docs/en/privacy/index.html",
    "docs/en/terms/index.html",
    "docs/nutzungsbedingungen/index.html",
    "docs/support/index.html",
    "docs/en/support/index.html",
    "docs/daten-loeschen/index.html",
    "docs/en/delete-data/index.html"
  ];
  for (const path of publicPages) {
    const html = read(path);
    assert.doesNotMatch(html, /Niklas Galli/, path);
    assert.doesNotMatch(html, /Neuburger/, path);
    assert.doesNotMatch(html, /Karlshuld/, path);
    assert.doesNotMatch(html, /niklas\.galli@/, path);
    assert.match(html, /support@sapaude\.app/, path);
  }
  const imprint = read("docs/impressum/index.html");
  assert.match(imprint, /Niklas Galli/);
  assert.equal((imprint.match(/Niklas Galli/g) || []).length, 3);
  assert.match(imprint, /wie oben/);
  assert.match(imprint, /id="legal-notice"/);
  const enImprint = read("docs/en/impressum/index.html");
  assert.match(enImprint, /http-equiv="refresh" content="0; url=\/impressum\/#legal-notice"/);
  assert.doesNotMatch(enImprint, /Niklas Galli/);
  const dePrivacy = read("docs/privacy/index.html");
  const enPrivacy = read("docs/en/privacy/index.html");
  for (const html of [dePrivacy, enPrivacy]) {
    assert.match(html, /https:\/\/sapaude\.app\/pulse\.json/);
    assert.match(html, /https:\/\/sapaude\.app\/briefing\.json/);
    assert.doesNotMatch(html, /AILA-Content|niklasgalli|raw\.githubusercontent/);
  }
  assert.match(imprint, /Neuburger Straße 73a/);
  assert.match(imprint, /86668 Karlshuld/);
  assert.match(imprint, /support@sapaude\.app/);
  assert.match(imprint, /innerhalb von 48 Stunden/);
  assert.match(imprint, /within 48 hours/);
  assert.match(imprint, /39,99 €/);
  assert.match(imprint, /7,99 €/);
  assert.match(imprint, /39\.99 €/);
  assert.match(imprint, /7\.99 €/);
  assert.doesNotMatch(imprint, /soweit Apple sie anbietet|where Apple offers it/);
  assert.doesNotMatch(imprint, /niklas\.galli@/);
  assert.doesNotMatch(imprint, /tel:/i);
  assert.doesNotMatch(imprint, /\+49/);
  assert.doesNotMatch(dePrivacy, /kein Quiz/i);
  assert.doesNotMatch(enPrivacy, /no quiz/i);
  assert.match(dePrivacy, /RevenueCat/);
  assert.match(enPrivacy, /RevenueCat/);
  assert.match(dePrivacy, /IONOS SE, Elgendorfer Str\. 57, 56410 Montabaur/);
  assert.match(enPrivacy, /IONOS SE, Elgendorfer Str\. 57, 56410 Montabaur/);
  assert.match(dePrivacy, /Art\. 28 DSGVO/);
  assert.match(enPrivacy, /Article 28 GDPR/);
  assert.doesNotMatch(dePrivacy, /soweit Apple sie anbietet|soweit der Store sie anbietet/);
  assert.doesNotMatch(enPrivacy, /where Apple offers it|where the store offers it/);
  assert.match(dePrivacy, /Kein Tracking/);
  assert.match(enPrivacy, /No tracking/);
  const deTerms = read("docs/nutzungsbedingungen/index.html");
  const enTerms = read("docs/en/terms/index.html");
  assert.match(deTerms, /Produkthaftungsgesetz/);
  assert.match(deTerms, /wesentlichen Vertragspflicht/);
  assert.match(enTerms, /Product Liability Act/);
  assert.match(enTerms, /essential contractual duty/);
  assert.match(deTerms, /stdeula/);
  assert.match(enTerms, /stdeula/);
  assert.match(deTerms, /39,99 €/);
  assert.match(deTerms, /7,99 €/);
  assert.match(enTerms, /39\.99 €/);
  assert.match(enTerms, /7\.99 €/);
  assert.doesNotMatch(deTerms, /soweit Apple sie anbietet/);
  assert.doesNotMatch(enTerms, /where Apple offers it/);
  for (const html of [
    read("docs/index.html"),
    read("docs/en/index.html"),
    read("docs/impressum/index.html"),
    read("docs/support/index.html"),
    read("docs/en/support/index.html"),
    read("docs/daten-loeschen/index.html"),
    read("docs/en/delete-data/index.html"),
    dePrivacy,
    enPrivacy,
    deTerms,
    enTerms
  ]) {
    assert.match(html, /KI erstellt oder unterstützt|generated or assisted by AI/);
  }
});

test("story row, path, briefing fallback, and teams copy stay in sync", () => {
  const de = read("docs/index.html");
  const en = read("docs/en/index.html");
  const css = read("docs/landing.css");
  const js = read("docs/landing.js");
  const order = ["onboarding", "home", "lesson", "briefing"];

  for (const html of [en, de]) {
    const screens = html.slice(html.indexOf('id="screens"'), html.indexOf('id="learn"'));
    assert.deepEqual([...screens.matchAll(/data-story="([^"]+)"/g)].map((m) => m[1]), order);
    assert.equal((screens.match(/<figure/g) || []).length, 4);
    assert.doesNotMatch(screens, /<figcaption|phone-caption/);
    assert.doesNotMatch(screens, /activity-|is-crop|--mask/);
    assert.match(screens, /\/home-/);
    assert.match(screens, /type="image\/avif"/);
    assert.doesNotMatch(html, /Vector Databases/);
    assert.doesNotMatch(html, /kein Quiz|no quiz/i);
    assert.doesNotMatch(html, /Vier Fragen|Four questions/);
    assert.match(html, /class="prose"/);
    assert.match(html, /class="soon-badge"/);
    assert.match(html, /mailto:support@sapaude\.app\?subject=/);
    assert.match(html, /Basics/);
    assert.match(html, /Core/);
    assert.match(html, /Depth/);
    assert.match(html, /7/);
    assert.doesNotMatch(html, /€|\$\s?\d/);
  }

  assert.match(de, /So lernst du mit Sapaude/);
  assert.match(en, /How you learn with Sapaude/);
  assert.match(de, /Drei Level\. Du startest dort, wo du stehst\./);
  assert.match(en, /Three levels\. You start where you stand\./);
  assert.doesNotMatch(de, /Ein Bild des Pfads|merkt es im Raum/);
  assert.doesNotMatch(en, /A picture of the path|too late to notice/);
  assert.match(de, /Das Modell kann nur eine bestimmte Menge Text auf einmal im Blick behalten\. Bei langen Chats vergisst es den Anfang\./);
  assert.match(en, /A model can only hold a certain amount of text in view at once\. In a long chat, it forgets the beginning\./);
  assert.match(de, /ab 5 Min\./);
  assert.match(de, /Ohne Fachjargon/);
  assert.match(de, /Mehrmals täglich/);
  assert.doesNotMatch(de, /Jeden Morgen|7-Tage-Plan|5 Minuten am Tag/);
  assert.match(en, /from 5 min/);
  assert.match(en, /Without jargon/);
  assert.match(en, /Fresh several times/);
  assert.doesNotMatch(en, /Every morning|7-day plan|5 minutes a day/);
  assert.match(de, /Neue Wörter werden beim ersten Mal in normaler Sprache erklärt\./);
  assert.match(en, /New words are explained in plain language the first time they appear\./);
  assert.match(de, /ausreichende KI-Kompetenz ihrer Mitarbeitenden/);
  assert.match(en, /sufficient level of AI literacy/);
  assert.doesNotMatch(de, /Duolingo|müssen Unternehmen, die KI einsetzen, ihre Mitarbeitenden schulen/);
  assert.doesNotMatch(en, /Duolingo|have to train their staff/);
  assert.match(de, /Das Monatsabo hat keine Testphase/);
  assert.match(en, /The monthly plan has no trial/);
  assert.match(de, /Auf die Warteliste/);
  assert.match(en, /Join the waitlist/);
  assert.match(de, /Häufige Fragen\./);
  assert.match(en, /Common questions\./);
  assert.match(de, /Die Preise siehst du in der App/);
  assert.match(en, /You see the prices in the app/);
  assert.match(de, /Abonnements/);
  assert.match(en, /Subscriptions/);
  assert.match(de, /Deutsch und Englisch/);
  assert.match(en, /German and English/);
  assert.match(de, /KI-Agenten/);
  assert.match(de, /Alltags-Tool/);
  assert.match(de, /Im Hintergrund/);
  assert.doesNotMatch(de, /open weights|benchmarks/i);
  assert.doesNotMatch(en, /open weights|benchmarks/i);

  assert.match(css, /\.prose\s*\{[^}]*text-align:\s*left/);
  assert.match(read("docs/styles.css"), /text-align:\s*left/);
  assert.doesNotMatch(css, /text-align:\s*justify/);
  assert.doesNotMatch(read("docs/styles.css"), /text-align:\s*justify/);
  assert.match(css, /hyphens:\s*auto/);
  assert.match(css, /\.compare-card ul\s*\{[^}]*list-style:\s*none/);
  assert.match(css, /\.phone-stage\.story-row[\s\S]*repeat\(4,/);
  assert.doesNotMatch(css, /\.phone-screen\.is-crop/);
  assert.doesNotMatch(en, /--mask:|is-crop|Platzhalter|Placeholder/);
  assert.doesNotMatch(de, /--mask:|is-crop|Platzhalter|Placeholder/);
  assert.match(en, /type="image\/avif"/);
  assert.match(de, /type="image\/avif"/);
  assert.match(js, /plainEnough/);
  assert.match(js, /Neues Modell/);
  assert.match(js, /if \(picked\.length < 3\) return/);
  assert.doesNotMatch(js, /pulse\.json/);

  const jargon = eval(js.match(/const JARGON = (\/[\s\S]+?\/i);/)[1]);
  const day = JSON.parse(read("briefing.json")).days[0];
  const plain = day.items.filter((item) => {
    const deCopy = item.i18n && item.i18n.de;
    const blob = `${item.headline} ${item.summary} ${deCopy.headline} ${deCopy.summary}`;
    return item.level !== "advanced" && !jargon.test(blob);
  });
  assert.equal(plain.length >= 3, true);
  for (const item of plain.slice(0, 3)) {
    assert.notEqual(item.level, "advanced");
    assert.equal(typeof item.headline, "string");
    assert.equal(typeof item.summary, "string");
    assert.ok(item.headline.trim());
    assert.ok(item.summary.trim());
    const deCopy = item.i18n && item.i18n.de;
    assert.equal(typeof deCopy.headline, "string");
    assert.equal(typeof deCopy.summary, "string");
    assert.ok(deCopy.headline.trim());
    assert.ok(deCopy.summary.trim());
    assert.equal(jargon.test(`${item.headline} ${item.summary}`), false);
    assert.equal(jargon.test(`${deCopy.headline} ${deCopy.summary}`), false);
  }
});

test("sapaude wordmark, claims, and app mismatches", () => {
  const de = read("docs/index.html");
  const en = read("docs/en/index.html");
  const css = read("docs/landing.css");
  const legal = read("docs/styles.css");
  assert.match(de, /class="hero-claim">Veni, vidi, KI\./);
  assert.match(en, /class="hero-claim">Be brave\. Get smart\./);
  assert.match(de, /class="footer-claim">Veni, vidi, KI\./);
  assert.match(en, /class="footer-claim">Be brave\. Get smart\./);
  assert.match(de, /content="Veni, vidi, KI\./);
  assert.match(en, /content="Be brave\. Get smart\./);
  assert.doesNotMatch(de, /Be brave/);
  assert.doesNotMatch(en, /Veni, vidi/);
  assert.doesNotMatch(de, /Sapere aude/);
  assert.doesNotMatch(en, /Sapere aude/);
  assert.match(de, /aria-label="sapaude\."/);
  assert.match(en, /aria-label="sapaude\."/);
  assert.match(de, /aria-label="EN, English">EN</);
  assert.match(en, /aria-label="DE, Deutsch">DE</);
  assert.match(de, /Tägliches KI-Briefing/);
  assert.match(de, /Basics 1 &amp; 2 gratis – auch zum Hören/);
  assert.match(en, /Basics 1 &amp; 2 free – listening included/);
  assert.doesNotMatch(de, /Copilot|Lernpfad|Arbeit 01/);
  assert.doesNotMatch(en, /Copilot|Learning path|Work 01/);
  assert.match(de, /ich bin Sapi/);
  assert.match(en, /I'm Sapi/);
  assert.match(css, /#3C9EC4/);
  assert.match(legal, /#3C9EC4/);
  assert.match(read("docs/favicon.svg"), /#F6F1E8/);
  assert.match(read("docs/favicon.svg"), /#3C9EC4/);
  assert.match(de, /Basics 02<\/span><span class="cover-name">Tokens/);
  assert.match(en, /Basics 02<\/span><span class="cover-name">Tokens/);
  assert.doesNotMatch(de, /Prompts/);
  assert.doesNotMatch(en, /Prompts/);
  assert.match(de, /was ein Token ist/);
  assert.match(en, /what a token is/);
  assert.match(de, /Hören im Briefing ist Sapaude Pro/);
  assert.match(en, /Listening to the briefing is part of Sapaude Pro/);
  assert.doesNotMatch(de, /Briefing bleibt frei/);
  assert.doesNotMatch(en, /Briefing stays free/);
  assert.match(de, /data-briefing-date datetime="2026-10-22"/);
  assert.match(en, /data-briefing-date datetime="2026-10-22"/);
  assert.match(read("docs/landing.js"), /Europe\/Berlin/);
  assert.match(read("docs/support/index.html"), /Veni, vidi, KI\./);
  assert.match(read("docs/en/support/index.html"), /Be brave\. Get smart\./);
  assert.match(read("docs/404.html"), /Diese Seite gibt es nicht/);
  assert.match(read("docs/404.html"), /Be brave\. Get smart\./);
  assert.match(read("docs/sitemap.xml"), /https:\/\/sapaude\.app\/support\//);
  assert.match(read("docs/sitemap.xml"), /https:\/\/sapaude\.app\/en\/support\//);
  assert.match(read("docs/sitemap.xml"), /https:\/\/sapaude\.app\/daten-loeschen\//);
  assert.match(read("docs/sitemap.xml"), /https:\/\/sapaude\.app\/en\/delete-data\//);
  assert.match(read("docs/daten-loeschen/index.html"), /support@sapaude\.app/);
  assert.match(read("docs/en/delete-data/index.html"), /support@sapaude\.app/);
  assert.match(read("docs/daten-loeschen/index.html"), /30 Tagen/);
  assert.match(read("docs/en/delete-data/index.html"), /30 days/);
  assert.match(read("docs/privacy/index.html"), /daten-loeschen\//);
  assert.match(read("docs/en/privacy/index.html"), /delete-data\//);
  assert.match(read("docs/index.html"), /daten-loeschen\//);
  assert.match(read("docs/en/index.html"), /delete-data\//);

  function visible(html) {
    const stripped = html.replace(/https?:\/\/\S*(?:AILA|Sapaude)-Content\S*/g, "");
    const bits = [...stripped.matchAll(/(?:content|aria-label)="([^"]*)"/g)].map((m) => m[1]);
    const titles = [...stripped.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]);
    const body = stripped
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    return [body, ...bits, ...titles].join("\n");
  }
  const pages = walk(join(root, "docs")).filter((path) => path.endsWith(".html"));
  assert.ok(pages.length >= 12);
  for (const path of pages) {
    const rel = path.slice(root.length + 1);
    assert.doesNotMatch(visible(read(rel)), /\bAILA\b|\bAila\b|getaila/, rel);
  }
});
