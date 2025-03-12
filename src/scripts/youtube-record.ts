import type { Page } from "puppeteer";
import { Script, type ScriptResult } from "./script.ts";
import { config } from "../config.ts";
import type { RecordMetadata } from "../metadata.ts";
import { type FilePartsInfo, splitVideoByLimits } from "../utils/video-duration.ts";
import { type Timecode, Timecodes } from "../utils/timecodes.ts";

export class YoutubeRecord extends Script {
  readonly tag = "youtube-record";
  protected page!: Page;
  private metadata!: RecordMetadata;

  private splitted_files: FilePartsInfo[] = [];
  private timecodes: Timecode[][] = [];
  private current_file_index = 0;

  async run(): Promise<ScriptResult> {
    this.emit("progress", "start");

    if (!config.youtube.record.url) {
      throw new Error("url not set, skipping");
    }

    this.metadata = this.base_metadata.record;

    this.splitted_files = await this.splitFiles().catch((err) => {
      throw new Error("failed to split files", err);
    });
    if (this.metadata.timecodes) {
      this.timecodes = Timecodes.fromText(this.metadata.timecodes).toSplitAndShift2(
        this.splitted_files.map((file) => file.duration),
        this.metadata.youtube.start,
      );
    }
    const urls: string[] = [];

    for (const [index, file] of this.splitted_files.entries()) {
      this.current_file_index = index + 1;
      this.page = await this.createDefaultPage(this.browser);
      await this.page.goto(config.youtube.record.url);

      await this.attachVideo(file.file).catch((err) => {
        throw new Error(`failed to attach video, ${err.message}`);
      });
      await this.setTitle(
        this.metadata.title + (this.splitted_files.length > 1 ? ` Часть ${this.current_file_index}` : ""),
      ).catch((err) => {
        this.errors.push(`failed to set title, ${err.message}`);
      });
      if (this.metadata.youtube.description && this.metadata.youtube.description.length > 0) {
        await this.setDescription(this.composeDescription(index), [
          ...this.metadata.youtube.tags,
          ...this.metadata.youtube.default_tags,
        ]).catch((err) => {
          this.errors.push(`failed to set description, ${err.message}`);
        });
      }
      // if (this.metadata.youtube?.playlist) {
      //   await this.setPlaylist(this.metadata.youtube.playlist);
      // }
      await this.setKidsRadio().catch((err) => {
        this.errors.push(`failed to kids radio button, ${err.message}`);
      });
      await this.checkUploadStatus().catch((err) => {
        this.errors.push(`failed to check upload status, ${err.message}`);
      });
      if (this.metadata.preview) {
        await this.setPreview(this.metadata.preview).catch((err) => {
          this.errors.push(`failed to set preview, ${err.message}`);
        });
      }
      await this.gotoVisibility().catch((err) => {
        this.errors.push(`failed to goto vivibilty, ${err.message}`);
      });
      await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
      await this.setPrivate().catch((err) => {
        this.errors.push(`failed to set private, ${err.message}`);
      });
      const url = await this.savePost().catch((err) => {
        this.errors.push(`failed save post, ${err.message}`);
        return "";
      });
      urls.push(url);
    }

    return {
      summary: [
        ...urls.map((url) => `url: ${url}`),
        `files: ${this.splitted_files
          .map((item) => {
            return `${item.file} (${item.time}, offset ${item.offset_in_original})`;
          })
          .join(", ")}`,
      ],
      errors: this.errors,
      ts_start: this.ts_start,
    };
  }

  composeDescription(part_index = 0): string {
    let out = this.metadata.youtube.description ?? "";
    if (this.timecodes.length > 0 && this.timecodes[part_index]) {
      out += `\nТаймкоды:\n`;
      const timecodes = this.timecodes[part_index];
      out += timecodes.map((timecode) => `${timecode.time} – ${timecode.desc}`).join("\n");
    }
    return out;
  }

  private async attachVideo(file: string): Promise<void> {
    this.emit("progress", `attaching video [${this.current_file_index}]`);
    await this.page.locator('[id="create-icon"').click();
    await this.page.locator('[id="creation-menu"] [id="paper-list"] [id="text-item-0"]').click();

    const [file_input, button] = await Promise.all([
      this.page.waitForFileChooser(),
      this.page.locator('[id="select-files-button"]').setTimeout(15000).click(),
    ]).catch(() => [null, 123]);
    if (!file_input || button === 123 || typeof file_input === "number") {
      throw new Error("failed to attach video");
    }
    await file_input.accept([file]);
    this.emit("progress", "video attached");
  }

  private async setTitle(text: string): Promise<void> {
    this.emit("progress", `setting title [${this.current_file_index}]`);
    await this.page.locator('[id="title-textarea"] [id="input"] [id="textbox"]').click();
    await this.page.keyboard.down("ControlLeft");
    await this.page.keyboard.press("A");
    await this.page.keyboard.up("ControlLeft");
    await this.page.keyboard.press("Delete");
    await this.page.keyboard.type(text.replaceAll("\r", ""));
    this.emit("progress", "title done");
  }

  private async setDescription(text: string, tags: string[]): Promise<void> {
    this.emit("progress", `setting desciption [${this.current_file_index}]`);
    await this.page.locator('[id="description-textarea"] [id="input"] [id="textbox"]').click();
    await this.page.keyboard.down("ControlLeft");
    await this.page.keyboard.press("A");
    await this.page.keyboard.up("ControlLeft");
    await this.page.keyboard.press("Delete");
    await this.page.keyboard.type(text.replaceAll("\r", ""));
    if (tags.length > 0) {
      await this.page.keyboard.press("Enter");
      await this.page.keyboard.press("Enter");
      for (const tag of tags) {
        await this.page.keyboard.type(tag);
        await this.page.keyboard.press("Space");
      }
    }
    this.emit("progress", "desciption done");
  }

  async setPreview(file: string): Promise<void> {
    await this.page.waitForSelector("ytcp-thumbnail-uploader button");
    const el = await this.page.$("ytcp-thumbnail-uploader button")!;
    if (!el) {
      throw new Error("preview button not found");
    }
    this.tsemit("progress", `setting preview [${this.current_file_index}]`);
    const [file_input, _] = await Promise.all([this.page.waitForFileChooser(), el.click()]);
    if (!file_input) {
      throw new Error("preview file input not found");
    }
    await file_input.accept([file]);
    await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
  }

  private async setPlaylist(playlist_id: string): Promise<void> {
    this.emit("progress", `setting playlist [${this.current_file_index}]`);
    await this.page.locator("ytcp-video-metadata-playlists div.ytcp-dropdown-trigger").click();
    await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    await this.page.locator(`[test-id="${playlist_id}"]`).click();
    await this.page.locator('button[aria-label="Done"]').click();
    this.emit("progress", "playlist done");
  }

  private async setKidsRadio(): Promise<void> {
    this.emit("progress", `setting kids radio [${this.current_file_index}]`);
    const is_kids = await this.page
      .$eval('[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]', (el) => el.textContent)
      .catch(() => [null]);
    if (is_kids) {
      await this.page.locator('[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]').click();
    }
    this.emit("progress", "kids radio done");
  }

  private async checkUploadStatus(): Promise<void> {
    // let counter = 0;
    // const TIMEOUT = 300000; // 5 min

    this.emit("progress", `uploading [${this.current_file_index}]`);
    while (true) {
      const text = await this.page.$eval("span.ytcp-video-upload-progress", (el) => el.textContent).catch(() => [null]);
      if (text) {
        this.emit("progress", `uploading [${this.current_file_index}] ${text}`);
      }
      if ((text && text.includes("Checks complete.")) || text.includes("Проверка завершена.")) {
        this.emit("progress", "video uploaded");
        break;
      }
      // counter += 500;
      // if (counter > TIMEOUT) {
      //   throw new Error(`failed to upload video due timeout ${TIMEOUT}ms`);
      // }
      await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));
    }
  }

  private async gotoVisibility(): Promise<void> {
    this.emit("progress", `goto visibility [${this.current_file_index}]`);
    await this.page.locator('[test-id="REVIEW"]').click();
  }

  private async setPrivate(): Promise<void> {
    this.emit("progress", `set private [${this.current_file_index}]`);
    await this.page.locator('[name="PRIVATE"]').click();
  }

  private async savePost(): Promise<string> {
    this.emit("progress", `save post [${this.current_file_index}]`);
    const url = await this.page.$eval("a.ytcp-video-info", (el) => el.href).catch(() => [null]);
    await this.page.locator("#done-button button").click();
    await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 5000)));
    return url;
  }

  async splitFiles(): Promise<FilePartsInfo[]> {
    const out: FilePartsInfo[] = [];
    for (const [index, file] of this.metadata.files.entries()) {
      const parts = await splitVideoByLimits(
        file,
        this.metadata.youtube.limit,
        index === 0 ? this.metadata.youtube.start : "00:00:00",
        this.tag,
        (text) => this.tsemit("progress", text),
      );
      out.push(...parts);
    }
    return out;
  }
}
