import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as simpleIcons from "simple-icons";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "assets");
const USER = "GautamVhavle";
const DEVTO = "gautamvhavle";

/* ------------------------------------------------------------------ theme */
/* Monochrome, mirroring the portfolio's pure black/white identity. */

const THEMES = {
  dark: {
    ink: "#f0f0f0",
    muted: "#8b8b8b",
    faint: "#5c5c5c",
    line: "#262626",
    ramp: ["#171717", "#3a3a3a", "#666666", "#a3a3a3", "#f0f0f0"],
  },
  light: {
    ink: "#0a0a0a",
    muted: "#6b6b6b",
    faint: "#9a9a9a",
    line: "#e2e2e2",
    ramp: ["#ededed", "#c7c7c7", "#969696", "#535353", "#0a0a0a"],
  },
};

const MONO = "ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace";
const MONO_ADVANCE = 0.6; // monospace glyph width ratio makes layout deterministic

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const monoWidth = (text, size, tracking = 0) => text.length * (size * MONO_ADVANCE + tracking);

/* Renders as <img>, so no external font or script can load. Keep it self-contained. */
const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" fill="none">${body}</svg>\n`;

const kicker = (x, y, text, t) =>
  `<text x="${x}" y="${y}" font-family="${MONO}" font-size="9" letter-spacing="1.6" fill="${t.faint}">${esc(
    text.toUpperCase()
  )}</text>`;

/* -------------------------------------------------------------------- data */

async function getJSON(url) {
  const headers = { "User-Agent": `${USER}-profile-cards`, Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
}

async function collect() {
  const [profile, contrib] = await Promise.all([
    getJSON(`https://api.github.com/users/${USER}`),
    getJSON(`https://github-contributions-api.jogruber.de/v4/${USER}?y=last`),
  ]);

  let stars = 0;
  for (let page = 1; page <= 4; page++) {
    const repos = await getJSON(
      `https://api.github.com/users/${USER}/repos?per_page=100&page=${page}&type=owner`
    );
    for (const r of repos) {
      if (r.fork) continue;
      stars += r.stargazers_count;
    }
    if (repos.length < 100) break;
  }

  const days = contrib.contributions;
  const today = new Date().toISOString().slice(0, 10);

  // Current streak: walk backwards, tolerating an as-yet-uncommitted today.
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].date > today) continue;
    if (days[i].count > 0) streak++;
    else if (!(days[i].date === today && streak === 0)) break;
  }

  return {
    contributions: contrib.total.lastYear,
    days,
    repos: profile.public_repos,
    followers: profile.followers,
    stars,
    streak,
  };
}

/* ------------------------------------------------------------ stats strip */

function renderStats(data, t) {
  const W = 460;
  const H = 96;
  const cells = [
    [String(data.contributions), "contributions"],
    [String(data.repos), "repositories"],
    [String(data.stars), "stars earned"],
    [`${data.streak}d`, "current streak"],
  ];

  const colW = W / cells.length;
  let body = `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" stroke="${t.line}"/>`;

  cells.forEach(([value, label], i) => {
    const cx = colW * i + colW / 2;
    if (i > 0)
      body += `<line x1="${colW * i}" y1="22" x2="${colW * i}" y2="${H - 22}" stroke="${t.line}"/>`;
    body += `<text x="${cx - monoWidth(value, 21) / 2}" y="47" font-family="${MONO}" font-size="21" font-weight="600" fill="${t.ink}">${esc(
      value
    )}</text>`;
    body += `<text x="${cx - monoWidth(label.toUpperCase(), 8.5, 1.1) / 2}" y="68" font-family="${MONO}" font-size="8.5" letter-spacing="1.1" fill="${t.muted}">${esc(
      label.toUpperCase()
    )}</text>`;
  });

  return svg(W, H, body);
}

/* --------------------------------------------------------- contribution map */

function renderContributions(data, t) {
  const W = 880;
  const PAD = 16;
  const weeks = Math.ceil(data.days.length / 7);
  const pitch = (W - PAD * 2) / weeks;
  const cell = pitch - 2.6;
  const TOP = 54;
  const H = TOP + pitch * 7 + PAD;

  let body = kicker(PAD, 18, "contribution activity", t);
  const total = `${data.contributions} in the last year`;
  body += `<text x="${W - PAD - monoWidth(total, 10)}" y="18" font-family="${MONO}" font-size="10" fill="${t.muted}">${esc(
    total
  )}</text>`;
  body += `<line x1="${PAD}" y1="30" x2="${W - PAD}" y2="30" stroke="${t.line}"/>`;

  // Month ticks, skipping labels that would collide with the previous one.
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let lastMonth = -1;
  let lastX = -Infinity;
  data.days.forEach((day, i) => {
    if (i % 7 !== 0) return;
    const month = new Date(`${day.date}T00:00:00Z`).getUTCMonth();
    const x = PAD + (i / 7) * pitch;
    if (month !== lastMonth && x - lastX > 42 && x < W - PAD - 30) {
      body += `<text x="${x}" y="47" font-family="${MONO}" font-size="9" fill="${t.faint}">${MONTHS[month]}</text>`;
      lastMonth = month;
      lastX = x;
    }
  });

  data.days.forEach((day, i) => {
    const x = PAD + Math.floor(i / 7) * pitch;
    const y = TOP + (i % 7) * pitch;
    body += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(
      2
    )}" rx="2" fill="${t.ramp[day.level]}"/>`;
  });

  return svg(W, Math.round(H), body);
}

/* ---------------------------------------------------------------- stack grid */

/* TypeScript is listed without JavaScript on purpose: one implies the other. */
const STACK = [
  ["AI / LLM", [["LangChain", "langchain"], ["LangGraph", null], ["MCP", null], ["RAG", null], ["LlamaIndex", null], ["Ollama", "ollama"], ["LangFuse", null]]],
  ["Backend", [["Python", "python"], ["FastAPI", "fastapi"], ["PostgreSQL", "postgresql"], ["Supabase", "supabase"], ["Bash", "gnubash"]]],
  ["Frontend", [["TypeScript", "typescript"], ["React", "react"], ["Tailwind", "tailwindcss"], ["shadcn/ui", "shadcnui"]]],
  ["Platform", [["Docker", "docker"], ["Kubernetes", "kubernetes"], ["GitHub Actions", "githubactions"], ["Playwright", null], ["n8n", "n8n"]]],
];

const iconPath = (slug) => {
  if (!slug) return null;
  const key = "si" + slug.replace(/(^|[^a-z0-9])([a-z0-9])/g, (_, __, c) => c.toUpperCase());
  return simpleIcons[key]?.path ?? null;
};

function renderStack(t) {
  const PAD = 16;
  const GUTTER = 96;
  const ROW_H = 30;
  const GAP = 7;
  const FS = 11;
  const ICON = 12;

  // Lay out first so the card can be sized to its content rather than
  // stranding empty space on the right.
  let cursor = 34;
  const rows = STACK.map(([label, items]) => {
    let x = PAD + GUTTER;
    const pills = items.map(([name, slug]) => {
      const path = iconPath(slug);
      const w = 22 + monoWidth(name, FS) + (path ? ICON + 7 : 0);
      const pill = { name, path, x, w };
      x += w + GAP;
      return pill;
    });
    const row = { label, pills, y: cursor, end: x - GAP };
    cursor += ROW_H + GAP;
    return row;
  });

  const W = Math.ceil(Math.max(...rows.map((r) => r.end)) + PAD);
  const H = cursor - GAP + PAD;

  let body = kicker(PAD, 18, "stack", t);
  body += `<line x1="${PAD}" y1="30" x2="${W - PAD}" y2="30" stroke="${t.line}"/>`;

  for (const { label, pills, y } of rows) {
    body += `<text x="${PAD}" y="${y + ROW_H / 2 + 3}" font-family="${MONO}" font-size="9" letter-spacing="1" fill="${t.faint}">${esc(
      label.toUpperCase()
    )}</text>`;

    for (const { name, path, x, w } of pills) {
      body += `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(
        1
      )}" height="${ROW_H}" rx="${ROW_H / 2}" stroke="${t.line}"/>`;
      let tx = x + 11;
      if (path) {
        body += `<g transform="translate(${tx.toFixed(1)} ${(y + (ROW_H - ICON) / 2).toFixed(
          1
        )}) scale(${(ICON / 24).toFixed(4)})"><path d="${path}" fill="${t.muted}"/></g>`;
        tx += ICON + 7;
      }
      body += `<text x="${tx.toFixed(1)}" y="${y + ROW_H / 2 + 4}" font-family="${MONO}" font-size="${FS}" fill="${t.ink}">${esc(
        name
      )}</text>`;
    }
  }

  return svg(W, H, body);
}

/* -------------------------------------------------------------- writing feed */

/* Highest-signal posts out of the recent window, so the list stays fresh
   without demoting an article that actually landed. */
async function renderWriting() {
  const res = await fetch(`https://dev.to/api/articles?username=${DEVTO}&per_page=6`, {
    headers: { "User-Agent": `${USER}-profile-cards` },
  });
  if (!res.ok) throw new Error(`dev.to ${res.status}`);

  const posts = (await res.json())
    .sort((a, b) => b.public_reactions_count - a.public_reactions_count)
    .slice(0, 3)
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

  return posts
    .map((p) => {
      const when = new Date(p.published_at).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
      return `- [${p.title.replace(/([[\]])/g, "\\$1")}](${p.url}) <sub>&nbsp;${when}</sub>`;
    })
    .join("\n");
}

async function updateReadme(blocks) {
  const path = resolve(ROOT, "README.md");
  const readme = await readFile(path, "utf8");
  const next = Object.entries(blocks).reduce(
    (text, [name, block]) =>
      text.replace(
        new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`),
        `$1\n${block}\n$2`
      ),
    readme
  );
  if (next !== readme) await writeFile(path, next);
}

/* ---------------------------------------------------------------------- run */

const data = await collect();
await mkdir(OUT, { recursive: true });

for (const [name, theme] of Object.entries(THEMES)) {
  await writeFile(`${OUT}/stats-${name}.svg`, renderStats(data, theme));
  await writeFile(`${OUT}/contributions-${name}.svg`, renderContributions(data, theme));
  await writeFile(`${OUT}/stack-${name}.svg`, renderStack(theme));
}

await updateReadme({ writing: await renderWriting() });

console.log(
  `cards built: ${data.contributions} contributions · ${data.repos} repos · ${data.stars} stars · ${data.streak}d streak`
);
