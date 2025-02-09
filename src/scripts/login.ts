import type { Browser } from "puppeteer";
import type { Emitter } from "../events/event-manager.ts";

export async function login(browser: Browser, emit: Emitter): Promise<void> {
  emit("progress", "login");
  const pages = await browser.pages();
  await pages[0].setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  );
  await pages[0].setViewport({ width: 1366, height: 768 });
  await pages[0].evaluate(() => alert("Login to all target platforms and close browser."));
  await new Promise(() => {});
}
