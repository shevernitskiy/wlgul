// deno-lint-ignore-file no-window
import type { Page } from "puppeteer";
import { Script, type ScriptResult } from "./script.ts";
import { config } from "../config.ts";
import type { RecordMetadata } from "../metadata.ts";
import { Timecodes } from "../utils/timecodes.ts";
import { type FilePartsInfo, splitVideoByLimits } from "../utils/video-duration.ts";

export class Boosty extends Script {
  readonly tag = "boosty";
  protected page!: Page;
  private metadata!: RecordMetadata;

  private splitted_files: FilePartsInfo[] = [];
  private timecodes: Timecodes | undefined;

  async run(): Promise<ScriptResult> {
    this.tsemit("progress", "start");
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
      this.tsemit("progress", "logged in");
    } else {
      throw new Error("not logged in, skipping");
    }

    this.splitted_files = await this.splitFiles().catch((err) => {
      throw new Error("failed to split files", err);
    });
    if (this.metadata.timecodes) {
      this.timecodes = Timecodes.fromText(this.metadata.timecodes);
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
      await this.attachVideos(this.splitted_files).catch((err) => {
        throw new Error("failed to attach videos", err);
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
    if (this.metadata.timecodes && this.timecodes) {
      // const timecodes = this.computeTimecodes();

      await this.setTimecodes().catch((err) => {
        this.errors.push(`failed to set description 2nd time, ${err.message}`);
      });
    }

    await this.defferPost().catch((err) => {
      throw new Error("failed to deffer post", err);
    });
    const post_id = await this.savePost().catch((err) => {
      this.errors.push(`failed to save post with main info, ${err.message}`);
    });

    return {
      summary: [
        `url: https://boosty.to/${config.boosty.channel}/posts/${post_id}`,
        `files: ${
          this.splitted_files.map((item) => {
            return `${item.file} (${item.time}, offset ${item.offset_in_original})`;
          }).join(", ")
        }`,
      ],
      errors: this.errors,
      ts_start: this.ts_start,
    };
  }

  async setTitle(title: string): Promise<void> {
    this.tsemit("progress", "setting title");
    await this.page.locator('[data-test-id="TITLE"]').fill(title);
  }

  async attachVideos(files: FilePartsInfo[]): Promise<void> {
    const TIMEOUT = 300000; // 5 min

    for (let i = 0; i < files.length; i++) {
      this.tsemit("progress", `attaching video ${i + 1}/${files.length}`);

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
      await file_input.accept([files[i].file]);
      this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
      await this.page.click('[data-test-id="TITLE"]');
    }

    this.tsemit("progress", "uploading files");

    let last_status = "";
    let last_changed = Date.now();
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
        const new_status = `uploading ${lines.join(", ")}`;
        this.tsemit("progress", new_status);
        if (new_status !== last_status) {
          last_status = new_status;
          last_changed = Date.now();
        }
      }

      if (Date.now() - last_changed > TIMEOUT) {
        throw new Error(`upload timeout ${TIMEOUT}ms`);
      }

      if (video.length === files.length) {
        this.tsemit("progress", "uploaded");
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
      this.tsemit("progress", `setting preview ${i + 1}/${els.length}`);
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
    this.tsemit("progress", `setting teaser`);
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
    this.tsemit("progress", "deffering post");
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
    this.tsemit("progress", "setting description");
    await this.page.locator(
      '[data-test-id="RICHEDITOR:EDITOR_JS"] .ce-block:nth-last-of-type(1)',
    ).click();
    let i = 0;
    if (metadata.description) {
      const lines = metadata.description.split("\n");
      this.tsemit("progress", `setting description ${++i}/${lines.length}`);
      for (const line of lines) {
        await this.page.keyboard.press("Enter");
        await this.page.keyboard.type(line.replaceAll("\r", "").trim());
      }
    }
    await this.page.keyboard.press("Enter");
    await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
  }

  async setTimecodes(): Promise<void> {
    if (!this.metadata.timecodes || !this.timecodes) return;
    this.tsemit("progress", "setting timecodes");

    const timecodes = this.timecodes.toSplitAndShift(
      this.splitted_files.map((file) => file.duration),
      this.metadata.boosty.start,
    );

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
      let k = 0;
      for (const timecode of timecodes[i]) {
        this.tsemit(
          "progress",
          `setting timecodes video ${i + 1}/${els.length}, line ${k + 1}/${timecodes[i].length}`,
        );
        await this.page.keyboard.type(`${timecode.time} – ${timecode.desc}`);
        await this.page.keyboard.press("Enter");
        k++;
        await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
      }
    }
  }

  async savePost(): Promise<string> {
    this.tsemit("progress", "saving post");
    this.page.locator(
      "[class^=PopupContent_block] [class^=MessagePreviewPopup_buttons] button[class*=ContainedButton_colorDefault]",
    ).setTimeout(5000).click().catch(() => this.tsemit("progress", "no timecodes popup"));
    await this.page.locator(
      'button[data-test-id="COMMON_CONTAINERS_BLOGPOST_BLOGPOSTFORM:PUBLISH_BUTTON"]',
    ).click();
    await this.page.waitForNavigation().catch(() => this.tsemit("progress", "no post popup"));

    return await this.page.evaluate(() => window.location.href.split("/").at(-1) ?? "unknown");
  }

  async editPost(): Promise<void> {
    await this.page.locator('[data-test-id="COMMON_POST_POSTACTIONSMENU:ROOT"]')
      .click();
    await this.page.locator("[class^=ExtraActionsMenuItem_root]").click();
  }

  async addTags(tags: string[]): Promise<void> {
    this.tsemit("progress", "adding tags");
    await this.page.locator("[class^=Tags_body] input").click();
    for (const tag of tags) {
      await this.page.keyboard.type(tag);
      await this.page.keyboard.press("Enter");
    }
  }

  async newPost(): Promise<void> {
    this.tsemit("progress", "making new post");
    await this.page.locator('[data-test-id="BLOGLAYOUTWRAPPER:NEW_POST_BUTTON"]')
      .click();
  }

  async splitFiles(): Promise<FilePartsInfo[]> {
    const out: FilePartsInfo[] = [];
    for (const file of this.metadata.files) {
      const parts = await splitVideoByLimits(
        file,
        this.metadata.boosty.limit,
        this.metadata.boosty.start,
        this.tag,
        (text) => this.tsemit("progress", text),
      );
      out.push(...parts);
    }
    return out;
  }
}
