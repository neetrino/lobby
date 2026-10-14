export type Rgb = { r: number; g: number; b: number };
export type Hsv = { h: number; s: number; v: number };

const hexColor = /^#?([\da-f]{6})$/i;

/** Accepts `#rrggbb` and falls back to the CRM blue when the value is not a color. */
export function normalizeHex(value: string): string {
  const match = hexColor.exec(value.trim());
  const digits = match?.[1];
  return digits === undefined ? '#2563eb' : `#${digits.toLowerCase()}`;
}

export function hexToRgb(value: string): Rgb {
  const hex = normalizeHex(value).slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

export function rgbToHex(rgb: Rgb): string {
  return `#${byte(rgb.r)}${byte(rgb.g)}${byte(rgb.b)}`;
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  return { h: hue(red, green, blue, max, delta), s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const chroma = v * s;
  const section = ((h % 360) + 360) % 360 / 60;
  const mix = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] = sector(section, chroma, mix);
  const offset = v - chroma;
  return {
    r: Math.round((red + offset) * 255),
    g: Math.round((green + offset) * 255),
    b: Math.round((blue + offset) * 255),
  };
}

export function clampUnit(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function clampByte(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(255, Math.max(0, Math.round(value)));
}

function byte(value: number): string {
  return clampByte(value).toString(16).padStart(2, '0');
}

function hue(red: number, green: number, blue: number, max: number, delta: number): number {
  if (delta === 0) return 0;
  let turn = (green - blue) / delta;
  if (max === green) turn = (blue - red) / delta + 2;
  if (max === blue) turn = (red - green) / delta + 4;
  const degrees = turn * 60;
  return degrees < 0 ? degrees + 360 : degrees;
}

function sector(section: number, chroma: number, mix: number): [number, number, number] {
  if (section < 1) return [chroma, mix, 0];
  if (section < 2) return [mix, chroma, 0];
  if (section < 3) return [0, chroma, mix];
  if (section < 4) return [0, mix, chroma];
  if (section < 5) return [mix, 0, chroma];
  return [chroma, 0, mix];
}
