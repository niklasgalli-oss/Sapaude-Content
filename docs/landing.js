/**
 * Sapaude landing config.
 *
 * SAPAUDE_APP_STORE_URL is the only App Store link. Leave it as "" until the
 * listing exists. An empty value keeps the coming-soon lines: English says
 * "Coming soon on App Store" and "Coming soon on Google Play". German says
 * "Demnächst im App Store" and "Demnächst bei Google Play". Neither page
 * shows a Download on the App Store badge while this stays empty.
 * SAPAUDE_PLAY_STORE_URL stays "" until the public Play listing exists.
 * An empty value leaves the coming-soon line. A https://play.google.com
 * product URL turns that line into a link and uses data-play-label.
 * Do not set either constant to a placeholder.
 *
 * Apple's badge must link to the product page. When the listing is live, set
 * this to the https://apps.apple.com/... URL. The page then shows Apple's
 * official badge, unmodified, once, at 48px (minimum 40px) with 12px of clear
 * space. English uses the US-UK artwork. German uses the DE artwork
 * ("Laden im App Store"). App Store stays in English on the badge.
 */
const SAPAUDE_APP_STORE_URL = "";
const SAPAUDE_PLAY_STORE_URL = "";

const SAPAUDE_BRIEFING_URL = "https://sapaude.app/briefing.json";

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

const JARGON = /open[- ]?weights|benchmarks?|per million|pro Million|\bAPI\b|\$\s?\d|\d\s?\$|parameter|MoE|context window|\binference\b|GPT-\d|\bvon\s+\d{2,}\b|\bof\s+\d{2,}\b|llama|vLLM|Token-Limit|pro Token/i;

function appStoreProductUrl(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" || url.hostname !== "apps.apple.com") return "";
  return url.toString();
}

function playStoreProductUrl(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" || url.hostname !== "play.google.com") return "";
  return url.toString();
}

function wirePlay() {
  const root = document.querySelector("[data-sapaude-store]");
  if (!root) return;
  const href = playStoreProductUrl(SAPAUDE_PLAY_STORE_URL);
  if (!href) return;
  const pending = root.querySelector("[data-store-play]");
  if (!pending) return;
  const link = document.createElement("a");
  link.className = "store-pending store-play";
  link.href = href;
  link.textContent = pending.dataset.playLabel || pending.textContent;
  pending.replaceWith(link);
}

function wireStore() {
  const root = document.querySelector("[data-sapaude-store]");
  if (!root) return;
  const href = appStoreProductUrl(SAPAUDE_APP_STORE_URL);
  if (!href) return;
  const pending = root.querySelector("[data-store-pending]");
  if (!pending) return;
  const link = document.createElement("a");
  link.className = "store-link";
  link.href = href;
  const img = document.createElement("img");
  img.src = root.dataset.badge;
  img.alt = root.dataset.badgeAlt || "Download on the App Store";
  img.width = 144;
  img.height = 48;
  link.append(img);
  pending.replaceWith(link);
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

function copyFor(item, locale) {
  const de = item && item.i18n && item.i18n.de;
  if (locale === "de" && de && textOrEmpty(de.headline) && textOrEmpty(de.summary)) {
    return { headline: de.headline.trim(), summary: de.summary.trim() };
  }
  return {
    headline: textOrEmpty(item && item.headline),
    summary: textOrEmpty(item && item.summary)
  };
}

function formatDay(iso, locale) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function plainEnough(item, locale) {
  if (textOrEmpty(item && item.level) === "advanced") return false;
  const copy = copyFor(item, locale);
  return !JARGON.test(`${copy.headline} ${copy.summary}`);
}

function renderItem(item, locale) {
  const copy = copyFor(item, locale);
  if (!copy.headline || !copy.summary) return null;
  const li = document.createElement("li");
  li.className = "brief-item";

  const meta = document.createElement("p");
  meta.className = "item-meta";
  const tag = textOrEmpty(item.tag);
  const labels = TAG_LABEL[locale] || TAG_LABEL.en;
  const label = (tag && labels[tag]) || tag;
  if (label) {
    meta.textContent = label;
    li.append(meta);
  }

  const title = document.createElement("h3");
  title.textContent = copy.headline;
  li.append(title);

  const summary = document.createElement("p");
  summary.textContent = copy.summary;
  li.append(summary);

  const sourceName = textOrEmpty(item.source && item.source.name);
  const sourceUrl = httpsUrl(item.source && item.source.url);
  if (sourceName) {
    const source = document.createElement("p");
    source.className = "item-source";
    if (sourceUrl) {
      const a = document.createElement("a");
      a.href = sourceUrl;
      a.textContent = sourceName;
      source.append(a);
    } else {
      source.textContent = sourceName;
    }
    li.append(source);
  }
  return li;
}

async function berlinTodayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

async function freshenSampleDate(root, locale) {
  if (!root || root.dataset.briefingState === "live") return;
  const time = root.querySelector("[data-briefing-date]");
  if (!time) return;
  const today = await berlinTodayIso();
  const iso = (time.dateTime || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
  if (iso >= today) return;
  time.dateTime = today;
  const label = formatDay(today, locale);
  if (label) time.textContent = label;
}

async function loadBriefing() {
  const root = document.querySelector("[data-briefing]");
  if (!root) return;
  const list = root.querySelector("[data-briefing-list]");
  if (!list) return;
  const locale = root.dataset.locale === "de" ? "de" : "en";
  await freshenSampleDate(root, locale);
  try {
    const response = await fetch(SAPAUDE_BRIEFING_URL, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return;
    const data = await response.json();
    const day = data && Array.isArray(data.days) ? data.days[0] : null;
    if (!day || !Array.isArray(day.items)) return;
    const picked = day.items.filter((item) => plainEnough(item, locale)).slice(0, 3);
    if (picked.length < 3) return;
    const nodes = picked.map((item) => renderItem(item, locale)).filter(Boolean);
    if (!nodes.length) return;
    list.replaceChildren(...nodes);
    const time = root.querySelector("[data-briefing-date]");
    const label = formatDay(day.date, locale);
    if (time && label) {
      time.dateTime = day.date;
      time.textContent = label;
    }
    root.dataset.briefingState = "live";
  } catch {
    /* Static fallback stays. */
  }
}

function wirePhoneShots() {
  document.querySelectorAll(".phone-shot").forEach((img) => {
    const drop = () => {
      const screen = img.closest(".phone-screen");
      if (screen) screen.classList.add("is-pending");
      img.remove();
    };
    if (img.complete && img.naturalWidth === 0) drop();
    else img.addEventListener("error", drop, { once: true });
  });
}

wireStore();
wirePlay();
loadBriefing();
wirePhoneShots();
wireEditionMotion();

function wireEditionMotion() {
  const header = document.getElementById("site-header");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const floater = document.querySelector(".sapaude-float");
  const hero = document.getElementById("hero-section");
  const screens = document.getElementById("screens");
  const mobileChrome = window.matchMedia("(max-width: 959px)");
  const onScroll = () => {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 20);
    const top = document.getElementById("back-to-top");
    if (top) top.classList.toggle("is-visible", window.scrollY > 500);
    if (floater) {
      const pastHero = !hero || hero.getBoundingClientRect().bottom <= 96;
      floater.classList.toggle("is-visible", pastHero && !mobileChrome.matches);
    }
    if (top && screens && mobileChrome.matches) {
      const box = screens.getBoundingClientRect();
      const bandTop = window.innerHeight - 96;
      const coversPhones = box.top < window.innerHeight - 8 && box.bottom > bandTop;
      top.classList.toggle("is-clear", coversPhones);
    } else if (top) {
      top.classList.remove("is-clear");
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  mobileChrome.addEventListener("change", onScroll);
  onScroll();

  const burger = document.getElementById("mobile-menu-btn");
  const panel = document.getElementById("mobile-nav-panel");
  const backdrop = document.getElementById("nav-backdrop");
  const setNav = (open) => {
    panel?.classList.toggle("active", open);
    backdrop?.classList.toggle("active", open);
    burger?.setAttribute("aria-expanded", open ? "true" : "false");
    if (panel) {
      if (open) panel.removeAttribute("inert");
      else panel.setAttribute("inert", "");
    }
    document.body.style.overflow = open ? "hidden" : "";
  };
  burger?.addEventListener("click", () => {
    setNav(burger.getAttribute("aria-expanded") !== "true");
  });
  backdrop?.addEventListener("click", () => setNav(false));
  panel?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setNav(false));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setNav(false);
  });

  const links = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("main section[id]");
  if (sections.length && "IntersectionObserver" in window) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        links.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === "#" + id);
        });
      });
    }, { threshold: 0.3 });
    sections.forEach((section) => navObserver.observe(section));
  }

  const back = document.getElementById("back-to-top");
  back?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });

  if (!reduce && "IntersectionObserver" in window) {
    document.documentElement.classList.add("has-reveal");
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    document.querySelectorAll(".reveal-text").forEach((el) => revealObserver.observe(el));
  }
}

