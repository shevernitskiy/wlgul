import { existsSync } from "@std/fs";
import { parse } from "@std/toml/parse";
import { basename, join } from "@std/path";
import type { Emitter } from "./events/event-manager.ts";

export type Metadata = {
  record: RecordMetadata;
  shorts: ShortsMetadata;
};

export type RecordMetadata = {
  platforms: string[];
  files: string[];
  title: string;
  description: string | null;
  timecodes: string | null;
  preview: string | null;
  teaser: string | null;
  tags: string[];
  boosty: {
    start: string;
    limit: string;
  };
};

export type ShortsMetadata = {
  platforms: string[];
  file: string;
  title: string;
  description: string;
  tags: string[];
  default_tags: string[];
  youtube: {
    playlist: string | null;
  };
};

if (!Deno.env.get("METADATA")) {
  throw new Error("METADATA env is required");
}
if (!Deno.env.get("USERDATA")) {
  throw new Error("USERDATA env is required");
}
if (!Deno.env.get("CONTENT")) {
  throw new Error("CONTENT env is required");
}

const metadata_path = Deno.env.get("WLGUL_DOCKER")
  ? "./metadata.toml"
  : (Deno.env.get("METADATA") ?? "");

const content_path = Deno.env.get("WLGUL_DOCKER") ? "./content" : (
  Deno.env.get("CONTENT") ?? ""
);

export async function getMetadata(
  args: Record<string, string>,
  emit: Emitter,
): Promise<Metadata> {
  if (!(existsSync(metadata_path))) {
    emit("fail", "metadata file not found");
    Deno.exit(1);
  }

  const metadata = parse(
    await Deno.readTextFile(metadata_path),
  ) as Metadata;

  if (args.record) {
    if (!metadata.record.files) {
      emit("fail", "metadata file is empty");
      Deno.exit(1);
    }
    const files: string[] = [];
    for (const file of metadata.record.files) {
      const record_file = join(content_path, file);
      if (!(existsSync(record_file))) {
        emit("fail", `file not found: ${record_file}`);
        Deno.exit(1);
      } else {
        files.push(record_file);
      }
    }
    metadata.record.files = files;
    if (metadata.record.preview) {
      const preview_file = join(content_path, metadata.record.preview);
      if (!(existsSync(preview_file))) {
        emit("fail", `incorrect preview file: ${preview_file}`);
        Deno.exit(1);
      } else {
        metadata.record.preview = preview_file;
      }
    }
    if (metadata.record.teaser) {
      const teaser_file = join(content_path, metadata.record.teaser);
      if (!(existsSync(teaser_file))) {
        emit("fail", `incorrect teaser file: ${teaser_file}`);
        Deno.exit(1);
      } else {
        metadata.record.teaser = teaser_file;
      }
    }
    if (!metadata.record.title) {
      metadata.record.title = `File - ${basename(metadata.record.files[0])}`;
    }
    if (!metadata.record.boosty) {
      metadata.record.boosty = {
        start: "00:00:00",
        limit: "24:00:00",
      };
    }
  }

  if (args.shorts) {
    if (!metadata.shorts.file) {
      emit("fail", `metadata file is empty`);
      Deno.exit(1);
    }
    const shorts_file = join(content_path, metadata.shorts.file);
    if (!(existsSync(shorts_file))) {
      emit("fail", `file not found: ${shorts_file}`);
      Deno.exit(1);
    } else {
      metadata.shorts.file = shorts_file;
    }
    if (!metadata.shorts.title) {
      metadata.shorts.title = `File - ${basename(metadata.shorts.file)}`;
    }
  }

  return metadata;
}
