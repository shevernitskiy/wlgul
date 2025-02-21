// deno-lint-ignore-file no-explicit-any
import { offset, time } from "./timecodes.ts";
import { ffprobe } from "./ffprobe.ts";
import { parse } from "@std/path";
import { ffmpeg } from "./ffmpeg.ts";
import { existsSync } from "@std/fs";

export async function getVideoDuration(file: string): Promise<number> {
  if (Deno.build.os !== "windows" && Deno.build.os !== "linux") {
    throw new Error("Unsupported OS to use ffprobe");
  }

  const info = await ffprobe(file);
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

export type FilePartsInfo = {
  file: string;
  duration: number;
  time: string;
  offset_in_original: number;
};

export async function splitVideoByLimits(
  file: string,
  limit: string,
  start_offset?: string,
  postfix: string = "",
  on_progress: (message: string) => void = () => {},
): Promise<FilePartsInfo[]> {
  on_progress(`splitting file ${file}`);
  const limit_s = offset(limit);
  const start_offset_s = start_offset ? offset(start_offset) : 0;
  const total_duration = await getVideoDuration(file);
  const corrected_duration = total_duration - start_offset_s;
  const target_number_of_parts = Math.ceil(corrected_duration / limit_s);

  if (target_number_of_parts <= 1 && start_offset_s === 0) {
    on_progress("no need to split");
    return [{ file, duration: total_duration, time: time(total_duration), offset_in_original: 0 }];
  } else if (target_number_of_parts <= 1 && start_offset_s > 0) {
    on_progress(`remove start offset ${start_offset_s}`);
    const parsed_path = parse(file);
    const file_new = `${parsed_path.dir}/${parsed_path.name}_${postfix}_part0${parsed_path.ext}`;
    if (existsSync(file_new)) Deno.removeSync(file_new);
    await ffmpeg(file, file_new, start_offset_s);
    return [{
      file: file_new,
      duration: corrected_duration,
      time: time(corrected_duration),
      offset_in_original: start_offset_s,
    }];
  } else {
    const parts = [];
    const part_duration = Math.floor(corrected_duration / target_number_of_parts);
    on_progress(`splitting to ${target_number_of_parts} parts, duraiton ${part_duration}`);
    let part_start, part_end;

    for (let i = 0; i < target_number_of_parts; i++) {
      if (i === 0) {
        part_start = start_offset_s;
        part_end = part_start + part_duration;
      } else if (i === target_number_of_parts - 1) {
        part_start = i * part_duration + start_offset_s;
        part_end = undefined;
      } else {
        part_start = i * part_duration + start_offset_s;
        part_end = part_start + part_duration;
      }
      const part_duraiton = part_end ? part_end - part_start : total_duration - part_start;
      const parsed_path = parse(file);
      const file_new =
        `${parsed_path.dir}/${parsed_path.name}_${postfix}_part${i}${parsed_path.ext}`;
      if (existsSync(file_new)) Deno.removeSync(file_new);
      on_progress(`splitting part ${i + 1}/${target_number_of_parts}`);
      await ffmpeg(file, file_new, part_start, part_end);
      parts.push({
        file: file_new,
        duration: part_duraiton,
        time: time(part_duraiton),
        offset_in_original: part_start,
      });
    }

    return parts;
  }
}
