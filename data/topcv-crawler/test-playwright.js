const { chromium } = require('playwright');

async function main() {
  const url = process.argv[2] || 'https://www.topcv.vn/cong-ty';
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    locale: 'vi-VN',
    viewport: { width: 1440, height: 2200 },
  });

  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000);

  console.log('TITLE:', await page.title());
  console.log('URL:', page.url());
  const html = await page.content();
  console.log(html.slice(0, 4000));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
