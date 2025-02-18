export type Timecode = {
  time: string;
  desc: string;
  offset: number;
};

export function parseTimecodes(value: string): Timecode[] {
  const matches = value.matchAll(/(\d+:\d+:\d+) – (.+)/g);
  const out = Array.from(matches).map((match) => {
    const [time, desc] = match[0].split(" – ");
    return {
      time,
      desc,
      offset: offset(time),
    };
  });
  return out;
}

export function offset(time: string): number {
  let offset = 0;
  let pow = 0;
  for (const item of time.split(":").reverse()) {
    offset += parseInt(item, 10) * 60 ** pow;
    pow++;
  }
  return offset;
}

export function duration(length: number): string {
  const hours = ~~(length / 3600);
  const minutes = ~~((length - hours * 3600) / 60);
  const seconds = ~~(length - hours * 3600 - minutes * 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${
    seconds
      .toString()
      .padStart(2, "0")
  }`;
}

export function splitTimecodes(videos: number[], timecodes: Timecode[]): Timecode[][] {
  let prev_offset = 0;
  let cur_offset_limit = videos[0];
  let cur_offset_index = 0;
  let prev_item: Timecode | undefined = undefined;

  const out = [];
  let cur = [];

  for (const item of timecodes) {
    if (item.offset > cur_offset_limit) {
      cur_offset_index++;
      prev_offset = cur_offset_limit;
      cur_offset_limit += videos[cur_offset_index] ? videos[cur_offset_index] : Infinity;
      if (cur_offset_index >= videos.length) {
        cur_offset_index = videos.length - 1;
      }
      out.push(cur);
      cur = [];
      cur.push({ ...prev_item!, offset: 0, time: duration(0) });
    }
    cur.push({
      ...item,
      offset: item.offset - prev_offset,
      time: duration(item.offset - prev_offset),
    });
    prev_item = item;
  }

  if (cur.length > 0) {
    out.push(cur);
  }
  return out;
}
