// Convert "#RRGGBB" → "R G B" tuple string for use in CSS vars with rgb()
export function hexToRgbTuple(hex: string): string {
  const cleaned = hex.replace("#", "").trim();
  if (cleaned.length !== 6) return "200 84 44"; // fallback to terracotta
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

// Determine readable fg color (black/white) for a given brand color
export function readableFg(hex: string): string {
  const cleaned = hex.replace("#", "").trim();
  if (cleaned.length !== 6) return "255 255 255";
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  // Relative luminance (sRGB)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? "22 19 15" : "255 255 255";
}

export function themeStyle(primary: string, accent: string): React.CSSProperties {
  return {
    ["--brand-rgb" as never]: hexToRgbTuple(primary),
    ["--brand-fg-rgb" as never]: readableFg(primary),
    ["--accent-rgb" as never]: hexToRgbTuple(accent),
  };
}
