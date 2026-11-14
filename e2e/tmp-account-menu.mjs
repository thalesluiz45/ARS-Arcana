import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const OUT = "e2e/artifacts";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" }),
});

for (const width of [320, 360, 390]) {
  const context = await browser.newContext({
    viewport: { width, height: 720 },
    locale: "pt-BR",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("http://localhost:3000/preview-account-menu", { waitUntil: "domcontentloaded" });
  await page.locator('[aria-label="Abrir menu da sua conta"]').click();
  await page.waitForTimeout(300);

  const metrics = await page.evaluate(() => {
    const dialog = document.querySelector('[data-slot="dialog-content"]');
    const desc = document.querySelector('[data-slot="dialog-description"]');
    const footer = document.querySelector('[data-slot="dialog-footer"]');
    const button = footer?.querySelector("button");
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, top: r.top, bottom: r.bottom };
    };
    return {
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      dialog: rect(dialog),
      description: rect(desc),
      footer: rect(footer),
      button: rect(button),
      descScrollWidth: desc?.scrollWidth ?? null,
      descClientWidth: desc?.clientWidth ?? null,
      buttonText: button?.textContent?.trim() ?? null,
    };
  });
  console.log(width, JSON.stringify(metrics));
  await page.screenshot({ path: `${OUT}/account-menu-${width}.png`, fullPage: false });
  await context.close();
}

await browser.close();
