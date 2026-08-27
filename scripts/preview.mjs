// Local-only: renders README.md through GitHub's GFM API and rewrites the
// not-yet-published raw URLs to local files so the layout can be reviewed.
import { readFile, writeFile } from "node:fs/promises";

const md = await readFile(new URL("../README.md", import.meta.url), "utf8");

const res = await fetch("https://api.github.com/markdown", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/vnd.github+json" },
  body: JSON.stringify({ text: md, mode: "gfm" }),
});
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

const html = (await res.text()).replaceAll(
  "https://raw.githubusercontent.com/GautamVhavle/GautamVhavle/main/",
  ""
);

const page = (theme, bg, fg, border) => `
<div class="pane" data-theme="${theme}" style="background:${bg};color:${fg};--b:${border}">
  <article class="markdown-body">${html}</article>
</div>`;

await writeFile(
  new URL("../preview.html", import.meta.url),
  `<!doctype html><meta charset="utf-8"><title>README preview</title>
<style>
  :root { color-scheme: light dark }
  body { margin:0; font:16px/1.5 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif }
  .pane { padding:32px 24px }
  .markdown-body { max-width:896px; margin:0 auto }
  .markdown-body img { max-width:100%; display:inline-block }
  .markdown-body h1 { font-size:2em; font-weight:600; margin:.67em 0 .3em }
  .markdown-body h3 { font-size:1.25em; font-weight:600; margin:24px 0 12px }
  .markdown-body p { margin:0 0 14px }
  .markdown-body ul { margin:0 0 14px; padding-left:22px }
  .markdown-body li { margin:.25em 0 }
  .markdown-body sub { font-size:12px; color:#8b949e; vertical-align:baseline }
  .markdown-body a { color:#4493f8; text-decoration:none }
  .markdown-body table { border-collapse:collapse; width:100%; margin:8px 0 20px }
  .markdown-body td { padding:6px 13px; vertical-align:top }
  .divider { height:8px; background:#888; opacity:.25 }
</style>
${page("dark", "#0d1117", "#e6edf3", "#30363d")}
<div class="divider"></div>
${page("light", "#ffffff", "#1f2328", "#d1d9e0")}
<script>
  // Point each <picture> at the theme its pane represents.
  for (const pane of document.querySelectorAll(".pane")) {
    const dark = pane.dataset.theme === "dark";
    for (const img of pane.querySelectorAll("picture img")) {
      const src = img.getAttribute("src");
      if (src) img.setAttribute("src", dark ? src.replace("-light.svg", "-dark.svg") : src);
    }
  }
</script>`
);

console.log("preview.html written");
