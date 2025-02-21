import { normalize } from "@std/path";
import { TextLineStream } from "@std/streams/text-line-stream";

export const ffprobe_path = Deno.env.get("WLGUL_DOCKER")
  ? "ffprobe"
  : normalize("./bin/ffprobe.exe");

// deno-lint-ignore no-explicit-any
export async function ffprobe(file: string): Promise<any> {
  const cmd = new Deno.Command(ffprobe_path, {
    args: [
      "-hide_banner",
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_streams",
      file,
    ],
    stdout: "piped",
  });

  const child = cmd.spawn();
  const readable = child.stdout
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());

  let data = "";
  for await (const line of readable) {
    data += line;
  }

  await child.status;
  return JSON.parse(data);
}
