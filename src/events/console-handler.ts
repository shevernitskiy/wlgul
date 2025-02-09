import { Spinner } from "@std/cli/unstable-spinner";
import { green, red } from "@std/fmt/colors";
import { EventHandler } from "./event-manager.ts";

let spinner: Spinner | undefined;

const spinnerStop = () => {
  if (spinner) {
    spinner.stop();
    spinner = undefined;
  }
};

export const ConsoleHandler: EventHandler = {
  success: (topic: string, text: string) => {
    spinnerStop();
    console.log(`${green("√")} ${topic} |`, text);
  },
  fail: (topic: string, text?: string) => {
    spinnerStop();
    console.log(`${red("×")} ${topic} |`, text ?? "gailed");
  },
  progress: (topic: string, text: string) => {
    if (!spinner) {
      spinner = new Spinner({ message: `${topic} | ${text}`, color: "yellow" });
      spinner.start();
    } else {
      spinner.message = `${topic} | ${text}`;
    }
  },
  log: (topic: string, text) => {
    spinnerStop();
    console.log(`- ${topic} | ${text}`);
  },
};
