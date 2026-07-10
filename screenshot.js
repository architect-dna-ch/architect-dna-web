const { chromium } = require('/Users/besonnet.kl2/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1584, height: 396 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('file://' + path.resolve(__dirname, 'linkedin-banner.html'));
  await page.screenshot({ path: path.resolve(__dirname, 'banner.png') });
  await browser.close();
})();
