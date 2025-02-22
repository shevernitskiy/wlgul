import type { Page } from "puppeteer";
import { Script, type ScriptResult } from "./script.ts";
import { config } from "../config.ts";
import type { ShortsMetadata } from "../metadata.ts";

export class TikTok extends Script {
  readonly tag = "tiktok";
  protected page!: Page;
  private metadata!: ShortsMetadata;

  async run(): Promise<ScriptResult> {
    this.emit("progress", "start");

    this.metadata = this.base_metadata.shorts;
    this.page = await this.createDefaultPage(this.browser);
    await this.page.goto(config.tiktok.url);

    await this.attachVideo(this.metadata.file);
    await this.checkUploadStatus();
    await this.setDescription(
      `${this.metadata.title} ${this.metadata.tags.join(" ")}\n\n${this.metadata.description}\n${
        this.metadata.tags.join(" ")
      } ${this.metadata.default_tags.join(" ")}`,
    );
    await this.defferPost();
    await this.savePost();
    await this.page.waitForNavigation();
    await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 10000)));

    const url = await this.page.$eval(
      '[data-tt="components_PostInfoCell_a"]',
      (el) => el.href,
    ).catch(() => null);

    return {
      summary: [url],
      errors: this.errors,
    };
  }

  private async attachVideo(file: string): Promise<void> {
    this.emit("progress", "attaching video");

    const [file_input, button] = await Promise.all([
      this.page.waitForFileChooser(),
      this.page.locator("button.upload-stage-btn").setTimeout(15000).click(),
    ]).catch(() => [null, 123]);
    if (!file_input || button === 123 || typeof file_input === "number") {
      throw new Error("failed to attach video");
    }
    await file_input.accept([file]);
    this.emit("progress", "video attached");
  }

  private async checkUploadStatus(): Promise<void> {
    let success, fail = false;
    let text = "";

    this.emit("progress", "uploading");
    while (true) {
      [text, success, fail] = await this.page.$eval(
        "[data-e2e=upload_status_container] div.info-status",
        (el) => [
          el.textContent,
          el.classList.contains("success"),
          el.classList.contains("fail"),
        ],
      ).catch(() => [null, null, null]);
      if (text) {
        this.emit("progress", `uploading ${text.split("Длительность")[0]}`);
      }
      if (success || fail) break;
      await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));
    }

    if (success) {
      this.emit("progress", "video uploaded");
    }
    if (fail) {
      throw new Error("failed to upload video, skipping");
    }
  }

  private async setDescription(text: string): Promise<void> {
    this.emit("progress", "setting description");
    await this.page.locator(".public-DraftStyleDefault-block").click();
    await this.page.keyboard.down("ControlLeft");
    await this.page.keyboard.press("A");
    await this.page.keyboard.up("ControlLeft");
    await this.page.keyboard.press("Delete");
    await this.page.keyboard.type(text.replaceAll("\r", ""));
  }

  private async defferPost(): Promise<void> {
    this.emit("progress", "deffering post");
    await this.page.locator(".schedule-radio-container label:nth-last-of-type(1)")
      .click();
    await this.page.locator(
      ".scheduled-picker > div:nth-last-of-type(1) > div > .TUXTextInput",
    ).click();
    await this.page.locator(
      ".calendar-wrapper .month-header-wrapper span.arrow:nth-last-of-type(1)",
    ).click();
    await this.page.locator(
      ".calendar-wrapper .days-wrapper .day-span-container:nth-of-type(7)",
    ).click();
  }

  private async savePost(): Promise<void> {
    this.emit("progress", "saving post");
    await this.page.locator('[data-e2e="post_video_button"]').click();
  }
}
