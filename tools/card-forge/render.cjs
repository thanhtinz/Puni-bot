/** Render card PNGs with the Card Forge engine in headless Chrome.
 *  Usage: node render.cjs [slug ...]   (no args = all 411)
 *  Output: dashboard/public/cards/<slug>.png */
const puppeteer = require("/home/hatch/workspace/.dot21-tools/node_modules/puppeteer-core");
const fs = require("fs");
const path = require("path");

const TOOL = __dirname;
const REPO = path.resolve(TOOL, "..", "..");
const cards = JSON.parse(fs.readFileSync(path.join(TOOL, "out", "cards-data.json"), "utf8"));
const bundle = fs.readFileSync(path.join(TOOL, "out", "forge-bundle.js"), "utf8");
const only = process.argv.slice(2);
const todo = only.length ? cards.filter((c) => only.includes(c.slug)) : cards;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/home/hatch/.cache/puppeteer/chrome/linux-156.0.8078.47/chrome-linux64/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ content: bundle });
  const outDir = path.join(REPO, "dashboard", "public", "cards");
  fs.mkdirSync(outDir, { recursive: true });
  let done = 0;
  for (const entry of todo) {
    const art = fs.readFileSync(path.join(TOOL, "out", "art", entry.slug + ".png"));
    const dataUrl = await page.evaluate(
      (card, artUrl) => window.renderCard(card, artUrl),
      entry.card,
      "data:image/png;base64," + art.toString("base64"),
    );
    fs.writeFileSync(path.join(outDir, entry.slug + ".png"), Buffer.from(dataUrl.split(",")[1], "base64"));
    done++;
    if (done % 100 === 0) console.log("rendered", done);
  }
  console.log("total rendered:", done);
  await browser.close();
})();
