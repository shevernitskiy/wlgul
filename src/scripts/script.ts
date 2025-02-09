import type { Browser, Page } from "puppeteer";
import type { Emitter } from "../events/event-manager.ts";
import type { Metadata } from "../metadata.ts";

export abstract class Script {
  protected abstract page: Page;
  abstract readonly tag: string;

  constructor(
    protected browser: Browser,
    protected base_metadata: Metadata,
    protected emit: Emitter,
  ) {}

  abstract run(): Promise<string>;

  protected async createDefaultPage(browser: Browser): Promise<Page> {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    );
    await page.setViewport({ width: 1366, height: 768 });
    return page;
  }
}
