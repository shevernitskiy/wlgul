import puppeteer from "puppeteer";
import { normalize } from "@std/path";
import { existsSync } from "@std/fs";
import { parseArgs } from "@std/cli";

import { login } from "./scripts/login.ts";
import { getMetadata, type Metadata } from "./metadata.ts";
import { type Emitter, EventManager } from "./events/event-manager.ts";
import { ConsoleHandler2 } from "./events/console-handler2.ts";
// import { ConsoleHandler } from "./events/console-handler.ts";
import type { Script } from "./scripts/script.ts";
import { Boosty } from "./scripts/boosty.ts";
import { TikTok } from "./scripts/tiktok.ts";
import { VkClip } from "./scripts/vkclip.ts";
import { YoutubeShorts } from "./scripts/youtube-shorts.ts";

if (!Deno.env.get("METADATA")) {
  throw new Error("METADATA env is required");
}
if (!Deno.env.get("USERDATA")) {
  throw new Error("USERDATA env is required");
}

export const ScriptsMap: {
  [key: string]: {
    // deno-lint-ignore no-explicit-any
    [key: string]: new (...args: any[]) => Script;
  };
} = {
  record: {
    boosty: Boosty,
  },
  shorts: {
    tiktok: TikTok,
    vk: VkClip,
    youtube: YoutubeShorts,
  },
};

export const event_manager = new EventManager({ handlers: [ConsoleHandler2] });
export const system: Emitter = (event, text) => event_manager.emit("system", event, text);
const args = parseArgs<Record<string, string>>(Deno.args);
const metadata = await getMetadata(args, system);

async function main(): Promise<void> {
  system("log", "start");
  let need_login = args.login || false;

  const userdata = normalize(Deno.env.get("USERDATA") || "./data");
  if (!(existsSync(userdata))) {
    await Deno.mkdir(userdata);
    need_login = true;
    system("log", "no userdata found, login required");
  }

  const browser = await puppeteer.launch({
    headless: !(need_login || args.ui || Deno.env.get("UI") === "true"),
    userDataDir: userdata,
    browser: "chrome",
    slowMo: 30, // TODO: pass it from env
    args: need_login ? ["--disable-blink-features=AutomationControlled"] : [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      // "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  if (need_login) {
    browser.on("disconnected", () => {
      system("log", "browser disconnected");
      Deno.exit(0);
    });
    await login(browser, system);
    await browser.close();
  }

  const pipelines: (keyof Metadata)[] = [];
  if (args.record) pipelines.push("record");
  if (args.shorts) pipelines.push("shorts");

  // FIXME: parallel not working, maybe beacuse of blocking main thread, consider to use worker
  for (const pipeline of pipelines) {
    system("log", pipeline);
    for (const platform of metadata[pipeline].platforms) {
      const emit: Emitter = (event, text) => event_manager.emit(platform, event, text);
      if (ScriptsMap[pipeline][platform as keyof typeof ScriptsMap[typeof pipeline]]) {
        const script = new ScriptsMap[pipeline][platform](browser, metadata, emit);
        await script.run()
          .then((result) => emit("success", result))
          .catch((e: Error) => emit("fail", e.message));
      } else {
        system("fail", `unknown platform: ${platform}`);
      }
    }
  }

  await browser.close();
  system("log", "done, exiting...");
}

main().catch(console.error);
