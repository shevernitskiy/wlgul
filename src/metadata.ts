import { existsSync } from "@std/fs";
import { parse } from "@std/toml/parse";
import { basename } from "@std/path";
import type { Emitter } from "./events/event-manager.ts";

export type Metadata = {
  record: RecordMetadata;
  shorts: ShortsMetadata;
};

export type RecordMetadata = {
  platforms: string[];
  file: string;
  title: string;
  description: string | null;
  timecodes: string | null;
  preview: string | null;
  tags: string[];
};

export type ShortsMetadata = {
  platforms: string[];
  file: string;
  title: string;
  description: string;
  tags: string[];
  default_tags: string[];
};

export async function getMetadata(
  args: Record<string, string>,
  emit: Emitter,
): Promise<Metadata> {
  if (!(existsSync(args.metadata ?? Deno.env.get("METADATA") ?? ""))) {
    emit("fail", "metadata file not found");
    Deno.exit(1);
  }

  const metadata = parse(
    await Deno.readTextFile(args.metadata ?? Deno.env.get("METADATA") ?? ""),
  ) as Metadata;

  if (args.record) {
    if (!metadata.record.file) {
      emit("fail", "metadata file is empty");
      Deno.exit(1);
    }
    if (!(existsSync(metadata.record.file))) {
      emit("fail", `file not found: ${metadata.record.file}`);
      Deno.exit(1);
    }
    if (metadata.record.preview) {
      if (!(existsSync(metadata.record.preview))) {
        emit("fail", `incorrect preview file: ${metadata.record.preview}`);
        Deno.exit(1);
      }
    }
    if (!metadata.record.title) {
      metadata.record.title = `File - ${basename(metadata.record.file)}`;
    }
  }

  if (args.shorts) {
    if (!metadata.shorts.file) {
      emit("fail", `metadata file is empty`);
      Deno.exit(1);
    }
    if (!(existsSync(metadata.shorts.file))) {
      emit("fail", `file not found: ${metadata.record.file}`);
      Deno.exit(1);
    }
    if (!metadata.shorts.title) {
      metadata.shorts.title = `File - ${basename(metadata.shorts.file)}`;
    }
  }

  return metadata;
}
