// @ts-types="npm:@types/spinnies"
import Spinnies from "spinnies";
import { green, red } from "@std/fmt/colors";
import type { EventHandler } from "./event-manager.ts";

const spinnies = new Spinnies();

export const ConsoleHandler2: EventHandler = {
  success: (topic: string, text: string) => {
    const s = spinnies.pick(topic);
    if (s) {
      spinnies.succeed(topic, { text: `${topic} | ${text}` });
    } else {
      console.log(`${green("✓")} ${topic} | ${text}`);
    }
  },
  fail: (topic: string, text?: string) => {
    const s = spinnies.pick(topic);
    if (s) {
      spinnies.fail(topic, { text: `${topic} | ${text}` });
    } else {
      console.log(`${red("✖")} ${topic} |`, text ?? "failed");
    }
  },
  progress: (topic: string, text: string) => {
    const s = spinnies.pick(topic);
    if (s) {
      spinnies.update(topic, { text: `${topic} | ${text}` });
    } else {
      spinnies.add(topic, { text: `${topic} | ${text}` });
    }
  },
  log: (topic: string, text: string) => {
    console.log(`- ${topic} | ${text}`);
  },
};
