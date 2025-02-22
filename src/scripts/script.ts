import type { Browser, Page } from "puppeteer";
import type { Emitter } from "../events/event-manager.ts";
import type { Metadata } from "../metadata.ts";

export type ScriptResult = {
  summary: string[];
  errors: string[];
  // deno-lint-ignore no-explicit-any
  ctx?: any;
};

export abstract class Script {
  protected abstract page: Page;
  abstract readonly tag: string;
  errors: string[] = [];

  constructor(
    protected browser: Browser,
    protected base_metadata: Metadata,
    protected emit: Emitter,
  ) {}

  abstract run(): Promise<ScriptResult>;

  protected async createDefaultPage(browser: Browser): Promise<Page> {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    );
    await page.setViewport({ width: 1366, height: 768 });
    return page;
  }
}

export function printScriptResult(result: ScriptResult): string {
  let out = "";
  if (result.summary.length === 1) {
    out += `${result.summary[0]}`;
  }
  if (result.summary.length > 1) {
    out += `summary\n${result.summary.map((s) => "• " + s).join("\n")}`;
  }
  if (result.errors.length > 0) {
    out += `\n• errors\n${result.errors.map((s) => "• " + s).join("\n")}`;
  }
  return out;
}
