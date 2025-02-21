import { normalize } from "@std/path";
import { TextLineStream } from "@std/streams/text-line-stream";

export const ffmpeg_path = Deno.env.get("WLGUL_DOCKER") ? "ffmpeg" : normalize("./bin/ffmpeg.exe");

export async function ffmpeg(
  file: string,
  file_new: string,
  start_offset: number,
  end_offset?: number,
): Promise<Deno.CommandStatus> {
  const args = [
    "-hide_banner",
    "-loglevel",
    "quiet",
    "-i",
    file,
    "-ss",
    `${start_offset}`,
  ];
  if (end_offset) {
    args.push("-to", `${end_offset}`);
  }
  args.push("-c", "copy", file_new);

  const cmd = new Deno.Command(ffmpeg_path, {
    args,
    stderr: "piped",
  });

  const child = cmd.spawn();
  const readable = child.stderr
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());

  for await (const line of readable) {
    console.log("ffmpeg", line);
  }

  return await child.status;
}
