const boosty = Deno.env.get("BOOSTY_CHANNEL");
const vk_group = Deno.env.get("VK_GROUP");
const youtube_channel_id = Deno.env.get("YOUTUBE_CHANNEL_ID");

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
    channel: youtube_channel_id,
    url: youtube_channel_id
      ? `https://studio.youtube.com/channel/${youtube_channel_id}`
      : undefined,
  },
};
