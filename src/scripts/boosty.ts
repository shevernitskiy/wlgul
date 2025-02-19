// deno-lint-ignore-file no-window
import type { Page } from "puppeteer";
import { parseTimecodes } from "../common.ts";
import { Script } from "./script.ts";
import { config } from "../config.ts";
import type { RecordMetadata } from "../metadata.ts";
import { splitTimecodes, type Timecode } from "../utils/timecodes.ts";
import { getVideoDuration } from "../utils/video-length.ts";

export class Boosty extends Script {
  readonly tag = "boosty";
  protected page!: Page;
  private metadata!: RecordMetadata;

  async run(): Promise<string> {
    this.emit("progress", "start");
    if (!config.boosty.url) {
      throw new Error("url not set, skipping");
    }

    this.metadata = this.base_metadata.record;
    this.page = await this.createDefaultPage(this.browser);
    await this.page.goto(config.boosty.url);

    const element = await this.page.$(
      '[data-test-id="COMMON_TOPMENU_TOPMENURIGHTAUTHORIZED:ROOT"]',
    );
    if (element) {
      this.emit("progress", "logged in");
    } else {
      throw new Error("not logged in, skipping");
    }

    await this.newPost().catch((err) => {
      throw new Error("failed to create new post", err);
    });

    if (this.metadata.title) {
      await this.setTitle(this.metadata.title).catch((err) => {
        this.errors.push(`failed to set title, ${err.message}`);
      });
    }
    if (this.metadata.files) {
      await this.attachVideos(this.metadata.files).catch((err) => {
        this.errors.push(`failed to attach videos, ${err.message}`);
      });
    }
    if (this.metadata.teaser) {
      await this.setTeaser(this.metadata.teaser).catch((err) => {
        this.errors.push(`failed to set teaser, ${err.message}`);
      });
    }
    if (this.metadata.preview && this.metadata.files.length > 0) {
      await this.setPreview(this.metadata.preview).catch((err) => {
        this.errors.push(`failed to set preview, ${err.message}`);
      });
    }
    if (this.metadata.tags) {
      await this.addTags(this.metadata.tags).catch((err) => {
        this.errors.push(`failed to add tags, ${err.message}`);
      });
    }
    if (this.metadata.timecodes) {
      const timecodes = await this.computeTimecodes();

      await this.setTimecodes(timecodes).catch((err) => {
        this.errors.push(`failed to set description 2nd time, ${err.message}`);
      });
    }

    await this.defferPost().catch((err) => {
      throw new Error("failed to deffer post", err);
    });
    const post_id = await this.savePost().catch((err) => {
      this.errors.push(`failed to save post with main info, ${err.message}`);
    });

    return `https://boosty.to/${config.boosty.channel}/posts/${post_id}`;
  }

  async setTitle(title: string): Promise<void> {
    this.emit("progress", "setting title");
    await this.page.locator('[data-test-id="TITLE"]').fill(title);
  }

  async attachVideos(files: string[]): Promise<void> {
    for (let i = 0; i < files.length; i++) {
      this.emit("progress", `attaching video ${i + 1}/${files.length}`);

      await this.page.click(
        '[data-test-id="RICHEDITOR:ROOT"] > [class^=Toolbar_toolbar] > [class^=ToolbarButton_wrapper]:nth-of-type(2) > button',
      );
      await this.page.waitForSelector(
        '[data-test-id="RICHEDITOR:ROOT"] button[class^=ToolbarTooltip_button] span[class^=ToolbarTooltip_sizeLimit]',
      );
      const [file_input, _] = await Promise.all([
        this.page.waitForFileChooser(),
        this.page.click(
          '[data-test-id="RICHEDITOR:ROOT"] button[class^=ToolbarTooltip_button] span[class^=ToolbarTooltip_sizeLimit]',
        ),
      ]);
      if (!file_input) {
        throw new Error("file input not found");
      }
      await file_input.accept([files[i]]);
      this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
      await this.page.click('[data-test-id="TITLE"]');
    }

    this.emit("progress", "uploading files");

    let uploadCompleted = false;
    while (!uploadCompleted) {
      const [precentage, size, video] = await Promise.all([
        this.page.$$eval(
          "[class^=FileBlock_headerPercentage]",
          (els) => els.map((el) => el.textContent),
        ).catch(() => [null]),
        this.page.$$eval(
          "[class^=FileBlock_size]",
          (els) => els.map((el) => el.textContent),
        ).catch(() => [null]),
        this.page.$$eval(
          "[class^=Video_video]",
          (els) => els.map((el) => el.textContent),
        ).catch(() => [null]),
      ]);

      if (precentage.filter(Boolean).length > 0) {
        const lines: string[] = [];
        for (let i = 0; i < precentage.length; i++) {
          lines.push(`[${i + 1}] ${precentage[i]} (${size[i].replaceAll(" ", "")})`);
        }
        this.emit("progress", `uploading ${lines.join(", ")}`);
      }

      if (video.length === files.length) {
        this.emit("progress", "uploaded");
        uploadCompleted = true;
      } else {
        await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
      }
    }
  }

  async setPreview(file: string): Promise<void> {
    await this.page.waitForSelector("button[class*=VideoPreviewEditor_button]");
    const els = await this.page.$$("button[class*=VideoPreviewEditor_button]");
    for (let i = 0; i < els.length; i++) {
      this.emit("progress", `setting preview ${i + 1}/${els.length}`);
      const [file_input, _] = await Promise.all([
        this.page.waitForFileChooser(),
        els[i].click(),
      ]);
      if (!file_input) {
        throw new Error("preview file input not found");
      }
      await file_input.accept([file]);
      await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    }
  }

  async setTeaser(file: string): Promise<void> {
    this.emit("progress", `setting teaser`);
    await this.page.waitForSelector('button[data-test-id="TEASERPHOTOBUTTON:button"]');
    const [file_input, _] = await Promise.all([
      this.page.waitForFileChooser(),
      this.page.click('button[data-test-id="TEASERPHOTOBUTTON:button"]'),
    ]);
    if (!file_input) {
      throw new Error("teaser file input not found");
    }
    await file_input.accept([file]);
    await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
  }

  async defferPost(): Promise<void> {
    this.emit("progress", "deffering post");
    await this.page.locator("[class^=DateNowOrDeferredSelector_btn]").click();
    await this.page.locator("button.react-calendar__navigation__label").click();
    await this.page.locator("button.react-calendar__navigation__label").click();
    await this.page.locator(
      "button.react-calendar__tile.react-calendar__decade-view__years__year:nth-last-of-type(1)",
    ).click();
    await this.page.locator(
      "button.react-calendar__tile.react-calendar__year-view__months__month:nth-last-of-type(1)",
    ).click();
    await this.page.locator(
      "button.react-calendar__tile.react-calendar__month-view__days__day.react-calendar__month-view__days__day--weekend:nth-last-of-type(15)",
    ).click();
    await this.page.locator(
      'button[data-test-id="COMMON_DATENOWORDEFERREDSELECTOR:DATE_PICKER_SUBMIT"]',
    ).click();
  }

  async getPostIdAndVideoId(): Promise<{
    post_id: string | null;
    videos_id: string[] | null;
  }> {
    const [post_id, videos_id] = await Promise.all([
      this.page.$eval(
        '[data-test-id="COMMON_POST:ROOT"]',
        (el) => el.attributes["data-post-id"]?.value,
      ),
      this.page.$$eval(
        "[class^=VideoBlock_root]",
        (els) => els.map((el) => (el.id ?? "").replace("video-", "")),
      ),
    ]).catch(() => [null, [null]]);
    return { post_id, videos_id: videos_id[0] === "" ? null : videos_id };
  }

  async setDescription(
    metadata: RecordMetadata,
  ): Promise<void> {
    this.emit("progress", "setting description");
    await this.page.locator(
      '[data-test-id="RICHEDITOR:EDITOR_JS"] .ce-block:nth-last-of-type(1)',
    ).click();
    let i = 0;
    if (metadata.description) {
      const lines = metadata.description.split("\n");
      this.emit("progress", `setting description ${++i}/${lines.length}`);
      for (const line of lines) {
        await this.page.keyboard.press("Enter");
        await this.page.keyboard.type(line.replaceAll("\r", "").trim());
      }
    }
    await this.page.keyboard.press("Enter");
    await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
  }

  async setTimecodes(
    timecodes: Timecode[][],
  ): Promise<void> {
    if (!this.metadata.timecodes) return;
    this.emit("progress", "setting description timecodes");

    await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 5000)));

    const els = await this.page.$$(
      '[data-test-id="RICHEDITOR:EDITOR_JS"] [class^=Video_video]',
    );

    for (let i = 0; i < els.length; i++) {
      if (!timecodes.at(i)) return;
      els[i].click();
      await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
      await this.page.keyboard.press("Enter");
      await this.page.keyboard.press("Backspace");
      for (const timecode of timecodes[i]) {
        await this.page.keyboard.type(`${timecode.time} – ${timecode.desc}`);
        await this.page.keyboard.press("Enter");
        await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
      }
    }
  }

  async savePost(): Promise<string> {
    this.emit("progress", "saving post");
    this.page.locator(
      "[class^=PopupContent_block] [class^=MessagePreviewPopup_buttons] button[class*=ContainedButton_colorDefault]",
    ).setTimeout(5000).click().catch(() => this.emit("progress", "no timecodes popup"));
    await this.page.locator(
      'button[data-test-id="COMMON_CONTAINERS_BLOGPOST_BLOGPOSTFORM:PUBLISH_BUTTON"]',
    ).click();
    await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 5000)));

    return await this.page.evaluate(() => window.location.href.split("/").at(-1) ?? "unknown");
  }

  async editPost(): Promise<void> {
    await this.page.locator('[data-test-id="COMMON_POST_POSTACTIONSMENU:ROOT"]')
      .click();
    await this.page.locator("[class^=ExtraActionsMenuItem_root]").click();
  }

  async addTags(tags: string[]): Promise<void> {
    this.emit("progress", "adding tags");
    await this.page.locator("[class^=Tags_body] input").click();
    for (const tag of tags) {
      await this.page.keyboard.type(tag);
      await this.page.keyboard.press("Enter");
    }
  }

  async newPost(): Promise<void> {
    this.emit("progress", "making new post");
    await this.page.locator('[data-test-id="BLOGLAYOUTWRAPPER:NEW_POST_BUTTON"]')
      .click();
  }

  async computeTimecodes(): Promise<Timecode[][]> {
    if (this.metadata.files.length === 0 || !this.metadata.timecodes) {
      return [];
    } else if (this.metadata.files.length === 1) {
      return [parseTimecodes(this.metadata.timecodes)];
    } else {
      const parsed = parseTimecodes(this.metadata.timecodes);
      const videos_length = (await Promise.allSettled(
        this.metadata.files.map((file) => getVideoDuration(file)),
      )).map((res) => res.status === "fulfilled" ? res.value : Infinity);

      return splitTimecodes(videos_length, parsed);
    }
  }
}
