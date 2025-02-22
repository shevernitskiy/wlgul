import type { Page } from "puppeteer";
import { Script, type ScriptResult } from "./script.ts";
import { config } from "../config.ts";
import type { ShortsMetadata } from "../metadata.ts";

export class VkClip extends Script {
  readonly tag = "vkclip";
  protected page!: Page;
  private metadata!: ShortsMetadata;

  async run(): Promise<ScriptResult> {
    this.emit("progress", "start");

    if (!config.vk.url) {
      throw new Error("url not set, skipping");
    }

    this.metadata = this.base_metadata.shorts;
    this.page = await this.createDefaultPage(this.browser);
    await this.page.goto(config.vk.url);

    await this.newClip();
    await this.attachVideo(this.metadata.file);
    await this.checkUploadStatus();
    await this.setDescription(`${this.metadata.title} ${this.metadata.tags.join(" ")}`);
    await this.defferPost();
    const url = await this.getClipUrl();
    await this.savePost();
    await this.page.waitForNavigation();

    return {
      summary: [url],
      errors: this.errors,
    };
  }

  private async newClip(): Promise<void> {
    this.emit("progress", "making new clip");
    await this.page.locator('[data-tab="short_videos"] a').click();
    await this.page.locator(
      '#group_tabs_content [data-tab="short_videos"] [data-role="add-content"]',
    ).click();
  }

  private async attachVideo(file: string): Promise<void> {
    this.emit("progress", "attaching video");

    const [file_input, button] = await Promise.all([
      this.page.waitForFileChooser(),
      this.page.locator('input[data-testid="video_upload_select_file"]').setTimeout(15000).click(),
    ]).catch(() => [null, 123]);
    if (!file_input || button === 123 || typeof file_input === "number") {
      throw new Error("failed to attach video");
    }
    await file_input.accept([file]);
    this.emit("progress", "video attached");
  }

  private async checkUploadStatus(): Promise<void> {
    let counter = 0;
    const TIMEOUT = 300000; // 5 min

    this.emit("progress", "uploading");
    while (true) {
      const text = await this.page.$eval(
        '[data-testid="clips-upload-status"]',
        (el) => el.textContent,
      ).catch(() => [null]);
      if (text) {
        this.emit("progress", `uploading ${text}`);
      }
      if (text && text.includes("Клип загружен и обработан")) {
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

  private async setDescription(text: string): Promise<void> {
    this.emit("progress", "setting description");
    await this.page.locator("[id^=clipDescription]").click();
    await this.page.keyboard.type(text.replaceAll("\r", ""));
  }

  private async defferPost(): Promise<void> {
    this.emit("progress", "deffering post");
    await this.page.locator('[data-testid="clips-upload-publish-date"] input')
      .click();
    await this.page.locator("div.vkuiCalendarHeader__nav-icon-next").click();
    await this.page.locator(
      "div.vkuiCalendarDays__row:nth-of-type(4) div.vkuiCalendarDay:nth-of-type(7)",
    ).click();
    await this.page.locator("div.vkuiCalendarTime__button button").click();
  }

  private async savePost(): Promise<void> {
    this.emit("progress", "saving post");
    await this.page.locator('[data-testid="clips-uploadForm-publish-button"]').click();
  }

  private async getClipUrl(): Promise<string> {
    const url = await this.page.$eval(
      '[data-testid="clips-upload-clip-link"]',
      (el) => el.textContent,
    ).catch(() => [null]);
    return url;
  }
}
