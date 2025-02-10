const boosty = Deno.env.get("BOOSTY_CHANNEL");
const vkgroup = Deno.env.get("VK_GROUP");

export const config = {
  boosty: {
    url: boosty ? `https://boosty.to/${boosty}` : undefined,
  },
  tiktok: {
    url: "https://www.tiktok.com/tiktokstudio/upload",
  },
  vk: {
    url: vkgroup ? `https://vk.com/${vkgroup}` : undefined,
  },
};
