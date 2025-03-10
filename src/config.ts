const boosty = Deno.env.get("BOOSTY_CHANNEL");
const vk_group = Deno.env.get("VK_GROUP");
const youtube_shorts = Deno.env.get("YOUTUBE_SHORTS_CHANNEL_ID");
const youtube_record = Deno.env.get("YOUTUBE_RECORD_CHANNEL_ID");

export const config = {
  boosty: {
    channel: boosty,
    url: boosty ? `https://boosty.to/${boosty}` : undefined,
  },
  tiktok: {
    url: "https://www.tiktok.com/tiktokstudio/upload",
  },
  vk: {
    channel: vk_group,
    url: vk_group ? `https://vk.com/${vk_group}` : undefined,
  },
  youtube: {
    shorts: {
      url: `https://studio.youtube.com/channel/${youtube_shorts}`,
    },
    record: {
      url: `https://studio.youtube.com/channel/${youtube_record}`,
    },
  },
};
