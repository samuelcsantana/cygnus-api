const UNIT_IN_SECONDS = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
} as const;

export function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration);

  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const amount = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  return amount * UNIT_IN_SECONDS[unit];
}
