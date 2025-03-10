const boosty = Deno.env.get("BOOSTY_CHANNEL");
const vk_group = Deno.env.get("VK_GROUP");

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
      url: `https://studio.youtube.com`,
    },
    record: {
      url: `https://studio.youtube.com`,
    },
  },
};
