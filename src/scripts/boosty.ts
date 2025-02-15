import type { Page } from "puppeteer";
// import { parseTimecodes } from "../common.ts";
import { Script } from "./script.ts";
import { config } from "../config.ts";
import type { RecordMetadata } from "../metadata.ts";

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

    await this.newPost();

    if (this.metadata.title) {
      await this.setTitle(this.metadata.title);
    }
    if (this.metadata.files) {
      await this.attachVideos(this.metadata.files);
    }
    if (this.metadata.preview && this.metadata.files.length > 0) {
      await this.setPreview(this.metadata.preview);
    }
    if (this.metadata.teaser) {
      await this.setTeaser(this.metadata.teaser);
    }
    if (this.metadata.tags) {
      await this.addTags(this.metadata.tags);
    }

    await this.defferPost();
    await this.savePost();
    await this.page.waitForNavigation();
    await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));

    // const { post_id, videos_id } = await this.getPostIdAndVideoId();
    const { post_id } = await this.getPostIdAndVideoId();

    // TODO: fix timecodes
    // if (this.metadata.description || this.metadata.timecodes) {
    if (this.metadata.description) {
      await this.editPost();
      // await this.setDescription(this.metadata, post_id, videos_id);
      await this.setDescription(this.metadata);
      await this.savePost();
    }

    return `https://boosty.to/${config.boosty.channel}/posts/${post_id}`;
  }

  async setTitle(title: string): Promise<void> {
    this.emit("progress", "setting title");
    await this.page.locator('[data-test-id="TITLE"]').fill(title);
  }

  async attachVideos(files: string[]): Promise<void> {
    for (let i = 0; i < files.length; i++) {
      this.emit("progress", `attaching video ${i + 1}/${files.length}`);
      await this.page.locator(
        '[data-test-id="RICHEDITOR:ROOT"] div[class^=ToolbarButton_wrapper]:nth-of-type(2) button',
      ).click();
      await this.page.waitForSelector(
        "button[class^=ToolbarTooltip_button] span[class^=ToolbarTooltip_sizeLimit]",
      );
      const [file_input, _] = await Promise.all([
        this.page.waitForFileChooser(),
        this.page.locator(
          "button[class^=ToolbarTooltip_button] span[class^=ToolbarTooltip_sizeLimit]",
        ).click(),
      ]);
      if (!file_input) {
        throw new Error("file input not found");
      }
      await file_input.accept([files[i]]);
      await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    }

    this.emit("progress", "uploading files");

    let uploadCompleted = false;
    while (!uploadCompleted) {
      const [precentage, _filename, size, video] = await Promise.all([
        this.page.$$eval(
          "[class^=FileBlock_headerPercentage]",
          (els) => els.map((el) => el.textContent),
        ).catch(() => [null]),
        this.page.$$eval(
          "[class^=FileBlock_fileName]",
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

      if (precentage[0]) {
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
    await this.page.waitForSelector('button[data-test-id="TEASERPHOTOBUTTON:button"]');
    this.emit("progress", `setting teaser`);
    const [file_input, _] = await Promise.all([
      this.page.waitForFileChooser(),
      this.page.locator('button[data-test-id="TEASERPHOTOBUTTON:button"]').click(),
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
    // post_id: string | null,
    // videos_id: string[] | null,
  ): Promise<void> {
    this.emit("progress", "setting description");
    await this.page.locator(
      '[data-test-id="RICHEDITOR:EDITOR_JS"] .codex-editor .codex-editor__redactor .ce-block:nth-last-of-type(1)',
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
    // if (metadata.timecodes) {
    //   this.emit("progress", "setting description timecodes");
    //   const timecodes = parseTimecodes(metadata.timecodes);

    //   if (timecodes.length > 1) {
    //     await this.page.keyboard.press("Enter");
    //     await this.page.keyboard.press("Enter");
    //     await this.page.keyboard.type("Таймкоды:");
    //   }
    //   i = 0;
    //   for (const timecode of timecodes) {
    //     this.emit("progress", `setting description timecodes ${++i}/${timecodes.length}`);
    //     await this.page.keyboard.press("Enter");
    //     await this.page.keyboard.type(timecode.time);
    //     if (post_id && video_id) {
    //       await this.page.keyboard.down("ShiftLeft");
    //       await this.page.keyboard.press("Home");
    //       await this.page.keyboard.up("ShiftLeft");
    //       await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
    //       await this.page.keyboard.down("ControlLeft");
    //       await this.page.keyboard.press("K");
    //       await this.page.keyboard.up("ControlLeft");
    //       await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
    //       await this.page.locator('input[placeholder="Вставьте ссылку"]')
    //         .setTimeout(90000)
    //         .fill(
    //           `${config.boosty.url}/posts/${post_id}?t=${timecode.offset}&tmid=${video_id}`,
    //         );
    //       await this.page.keyboard.press("Enter");
    //       await this.page.keyboard.type(` – ${timecode.desc}`);
    //     }
    //   }
    // }
    await this.page.keyboard.press("Enter");
  }

  async savePost(): Promise<void> {
    await this.page.locator(
      'button[data-test-id="COMMON_CONTAINERS_BLOGPOST_BLOGPOSTFORM:PUBLISH_BUTTON"]',
    ).click();
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
}
