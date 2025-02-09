export function parseTimecodes(value: string): {
  time: string;
  desc: string;
  hours: string;
  minutes: string;
  seconds: string;
  offset: number;
}[] {
  const matches = value.matchAll(/(\d+:\d+:\d+) – (.+)/g);
  const out = Array.from(matches).map((match) => {
    const [time, desc] = match[0].split(" – ");
    const [hours, minutes, seconds] = time.split(":");
    return {
      time,
      desc,
      hours,
      minutes,
      seconds,
      offset: (parseInt(hours, 10) * 3600) + (parseInt(minutes, 10) * 60) +
        parseInt(seconds, 10),
    };
  });
  return out;
}
