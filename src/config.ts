const boosty = Deno.env.get("BOOSTY_CHANNEL");

export const config = {
  boosty: {
    url: boosty ? `https://boosty.to/${boosty}` : undefined,
  },
  tiktok: {
    url: "https://www.tiktok.com/tiktokstudio/upload",
  },
};
