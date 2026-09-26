// Render PNG previews for every concept + the contact sheet.
//   NODE_PATH=<dir with playwright-core> CHROME=<chromium binary> node render.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const HERE = __dirname;
const OUT = path.dirname(HERE);
const M = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json'), 'utf8'));
const L = M.light, D = M.dark;
const read = (p) => fs.readFileSync(path.join(OUT, p), 'utf8');
const strip = (s) => s.replace(/ width="[\d.]+" height="[\d.]+"/, ''); // let CSS size inline SVGs

const fontFace = `@font-face{font-family:Archivo;src:url('${M.font}') format('woff2');font-weight:100 900;font-stretch:62% 125%}`;

function coverHTML(c) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace}
  html,body{margin:0;width:1200px;height:800px;background:${L.bg};}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Archivo,sans-serif;color:${L.ink}}
  .lockup svg{width:700px;height:auto;display:block}
  p{margin:56px 0 0;font-size:34px;font-weight:520;font-stretch:92%;letter-spacing:-.005em;color:${L.dim}}
  </style></head><body>
  <div class="lockup">${strip(read(`${c.slug}/lockup.svg`))}</div>
  <p>See every crop bed live.</p>
  </body></html>`;
}

function sheetHTML() {
  const col = (c) => `
  <section>
    <h2>${c.name}</h2>
    <div class="cell sym">${strip(read(`${c.slug}/symbol.svg`))}</div>
    <div class="cell lock">${strip(read(`${c.slug}/lockup.svg`))}</div>
    <div class="cell lock dark">${strip(read(`${c.slug}/lockup-dark.svg`))}<span class="dsym">${strip(read(`${c.slug}/symbol-dark.svg`))}</span></div>
    <div class="cell fav">
      <img src="${c.slug}/favicon-16.png" width="16" height="16">
      <img src="${c.slug}/favicon-32.png" width="32" height="32">
      <img src="${c.slug}/favicon-180.png" width="90" height="90">
      <img class="zoom" src="${c.slug}/favicon-16.png" width="64" height="64">
      <span class="tab"><img src="${c.slug}/favicon-16.png" width="16" height="16">FarmHand</span>
    </div>
    <p>${c.idea}</p>
  </section>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace}
  html,body{margin:0;background:${L.bg};font-family:Archivo,sans-serif;color:${L.ink}}
  body{width:1800px;padding:48px 56px 56px;box-sizing:border-box}
  h1{margin:0 0 36px;font-size:26px;font-weight:680;font-stretch:88%;letter-spacing:-.01em}
  h1 span{font-weight:450;color:${L.dim};margin-left:12px}
  main{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
  section{display:flex;flex-direction:column;gap:14px}
  h2{margin:0 0 4px;font-size:22px;font-weight:680;font-stretch:88%}
  .cell{background:${L.panel};border-radius:10px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(22,32,26,.1)}
  .sym{height:260px}.sym svg{width:168px;height:168px}
  .lock{height:150px}.lock svg{width:360px;height:auto}
  .dark{background:${D.bg};border-color:${D.bg};gap:36px;height:180px}
  .dark .dsym svg{width:56px;height:56px;display:block}
  .dark .lock svg, .dark>svg{width:300px;height:auto}
  .fav{height:130px;gap:26px}
  .fav img{display:block}
  .zoom{image-rendering:pixelated;outline:1px dashed rgba(22,32,26,.25);outline-offset:4px}
  .tab{display:flex;align-items:center;gap:8px;font-size:13px;background:#dfe4dc;padding:7px 12px;border-radius:8px 8px 0 0}
  p{margin:4px 2px 0;font-size:16px;line-height:1.45;color:${L.dim};max-width:52ch}
  </style></head><body>
  <h1>FarmHand logo concepts<span>symbol · lockup · dark · favicon 16 / 32 / 180 (and 16 px at 4x)</span></h1>
  <main>${M.concepts.map(col).join('')}</main>
  </body></html>`;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME });
  const page = await browser.newPage();
  for (const c of M.concepts) {
    // favicons from the SVG at exact pixel sizes
    for (const px of [16, 32, 180]) {
      await page.setViewportSize({ width: px, height: px });
      await page.setContent(`<html><body style="margin:0;background:transparent">${strip(read(`${c.slug}/favicon.svg`)).replace('<svg', `<svg width="${px}" height="${px}" style="display:block"`)}</body></html>`);
      await page.screenshot({ path: path.join(OUT, c.slug, `favicon-${px}.png`), omitBackground: true });
    }
    await page.setViewportSize({ width: 1200, height: 800 });
    const f = path.join(HERE, `.cover-${c.slug}.html`);
    fs.writeFileSync(f, coverHTML(c));
    await page.goto('file://' + f);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, c.slug, 'devpost-cover-1200x800.png') });
    fs.unlinkSync(f);
  }
  const f = path.join(OUT, '.sheet.html');
  fs.writeFileSync(f, sheetHTML());
  await page.setViewportSize({ width: 1800, height: 900 });
  await page.goto('file://' + f);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, 'contact-sheet.png'), fullPage: true });
  fs.unlinkSync(f);
  await browser.close();
  console.log('rendered');
})();
