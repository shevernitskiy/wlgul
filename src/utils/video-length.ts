// deno-lint-ignore-file no-explicit-any
import * as ffprobe from "ffprobe";
import { normalize } from "@std/path";
import { offset } from "./timecodes.ts";

export async function getVideoDuration(path: string): Promise<number> {
  if (Deno.build.os !== "windows" && Deno.build.os !== "linux") {
    throw new Error("Unsupported OS to use ffprobe");
  }
  const ffmpeg_path = normalize(
    Deno.build.os === "windows" ? "./bin/ffprobe.exe" : "./bin/ffprobe",
  );

  const info = await ffprobe.default(path, { path: ffmpeg_path });

  const video_stream = info.streams.find((stream: any) => stream.codec_type === "video");
  let length = 0;
  if (video_stream?.duration) {
    length = parseInt(video_stream.duration, 10) ?? 0;
  } else if (video_stream?.tags.DURATION) {
    length = offset(video_stream.tags.DURATION.split(".")[0]);
  }

  if (length > 0) return length;
  const audio_stream = info.streams.find((stream: any) => stream.codec_type === "audio");
  if (audio_stream?.duration) {
    length = parseInt(audio_stream.duration, 10) ?? 0;
  } else if (audio_stream?.tags.DURATION) {
    length = offset(audio_stream.tags.DURATION.split(".")[0]);
  }
  return length;
}
