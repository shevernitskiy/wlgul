import type { Page } from "puppeteer";
import { Script } from "./script.ts";
import { config } from "../config.ts";
import type { ShortsMetadata } from "../metadata.ts";

export class YoutubeShorts extends Script {
  readonly tag = "youtube-shorts";
  protected page!: Page;
  private metadata!: ShortsMetadata;

  async run(): Promise<string> {
    this.emit("progress", "start");

    if (!config.youtube.url) {
      throw new Error("url not set, skipping");
    }

    this.metadata = this.base_metadata.shorts;
    this.page = await this.createDefaultPage(this.browser);
    await this.page.goto(config.youtube.url);

    await this.attachVideo(this.metadata.file);
    await this.setTitle(this.metadata.title, this.metadata.tags);
    await this.setDescription(this.metadata.description, [
      ...this.metadata.tags,
      ...this.metadata.default_tags,
    ]);
    if (this.metadata.yt_playlist) {
      await this.setPlaylist(this.metadata.yt_playlist);
    }
    await this.setKidsRadio();
    await this.checkUploadStatus();
    await this.gotoVisibility();
    await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    await this.setPrivate();
    const url = await this.savePost();
    return url;
  }

  private async attachVideo(file: string): Promise<void> {
    this.emit("progress", "attaching video");
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

  private async setTitle(text: string, tags: string[]): Promise<void> {
    this.emit("progress", "setting title");
    await this.page.locator('[id="title-textarea"] [id="input"] [id="textbox"]').click();
    await this.page.keyboard.down("ControlLeft");
    await this.page.keyboard.press("A");
    await this.page.keyboard.up("ControlLeft");
    await this.page.keyboard.press("Delete");
    await this.page.keyboard.type(text.replaceAll("\r", ""));
    if (tags.length > 0) {
      await this.page.keyboard.type(" ");
      for (const tag of tags) {
        await this.page.keyboard.type(tag);
        await this.page.keyboard.press("Space");
      }
    }
    this.emit("progress", "title done");
  }

  private async setDescription(text: string, tags: string[]): Promise<void> {
    this.emit("progress", "setting desciption");
    await this.page.locator('[id="description-textarea"] [id="input"] [id="textbox"]').click();
    await this.page.keyboard.type(text.replaceAll("\r", ""));
    if (tags.length > 0) {
      await this.page.keyboard.press("Enter");
      for (const tag of tags) {
        await this.page.keyboard.type(tag);
        await this.page.keyboard.press("Space");
      }
    }
    this.emit("progress", "desciption done");
  }

  private async setPlaylist(playlist_id: string): Promise<void> {
    this.emit("progress", "setting playlist");
    await this.page.locator("ytcp-video-metadata-playlists div.ytcp-dropdown-trigger").click();
    await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    await this.page.locator(`[test-id="${playlist_id}"]`).click();
    await this.page.locator('button[aria-label="Done"]').click();
    this.emit("progress", "playlist done");
  }

  private async setKidsRadio(): Promise<void> {
    this.emit("progress", "setting kids radio");
    const is_kids = await this.page.$eval(
      '[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]',
      (el) => el.textContent,
    ).catch(() => [null]);
    if (is_kids) {
      await this.page.locator('[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]').click();
    }
    this.emit("progress", "kids radio done");
  }

  private async checkUploadStatus(): Promise<void> {
    let counter = 0;
    const TIMEOUT = 300000; // 5 min

    this.emit("progress", "uploading");
    while (true) {
      const text = await this.page.$eval(
        "span.ytcp-video-upload-progress",
        (el) => el.textContent,
      ).catch(() => [null]);
      if (text) {
        this.emit("progress", `uploading ${text}`);
      }
      if (text && text.includes("Checks complete. No issues found.")) {
        this.emit("progress", "video uploaded");
        break;
      }
      counter += 500;
      if (counter > TIMEOUT) {
        throw new Error(`failed to upload video due timeout ${TIMEOUT}ms`);
      }
      await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));
    }
  }

  private async gotoVisibility(): Promise<void> {
    this.emit("progress", "goto visibility");
    await this.page.locator('[test-id="REVIEW"]').click();
  }

  private async setPrivate(): Promise<void> {
    this.emit("progress", "set private");
    await this.page.locator('[name="PRIVATE"]').click();
  }

  private async savePost(): Promise<string> {
    this.emit("progress", "save post");
    const url = await this.page.$eval("a.ytcp-video-info", (el) => el.href).catch(() => [null]);
    await this.page.locator('button[aria-label="Save"]').click();
    return url;
  }
}
