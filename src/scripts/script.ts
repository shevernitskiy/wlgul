import type { Browser, Page } from "puppeteer";
import type { Emitter, Event } from "../events/event-manager.ts";
import type { Metadata } from "../metadata.ts";
import { time } from "../utils/timecodes.ts";

export type ScriptResult = {
  summary: string[];
  errors: string[];
  ts_start: number;
  // deno-lint-ignore no-explicit-any
  ctx?: any;
};

export abstract class Script {
  protected abstract page: Page;
  abstract readonly tag: string;
  errors: string[] = [];
  protected ts_start: number;
  protected tsemit: (event: Event, text: string) => void;

  constructor(
    protected browser: Browser,
    protected base_metadata: Metadata,
    protected emit: Emitter,
  ) {
    this.ts_start = Date.now();
    this.tsemit = (event, text) => this.emit(event, `${script_duration(this.ts_start)} | ${text}`);
  }

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

function script_duration(ts_start: number): string {
  return time(Math.round((Date.now() - ts_start) / 1000));
}

export function printScriptResult(result: ScriptResult): string {
  let out = `${script_duration(result.ts_start)}`;
  if (result.summary.length > 0) {
    out += `\n${result.summary.map((s) => "• " + s).join("\n")}`;
  }
  if (result.errors.length > 0) {
    out += `\n• errors: ${result.errors.map((s) => "• " + s).join("; ")}`;
  }
  return out;
}
