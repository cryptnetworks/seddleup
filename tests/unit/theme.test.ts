import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const themeCss = readFileSync("app/globals.css", "utf8");

function relativeLuminance(hex: string) {
  const channels = hex
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

describe("natural theme", () => {
  it("defines the shared semantic color and depth tokens", () => {
    for (const token of [
      "--app-background",
      "--app-surface",
      "--app-elevated",
      "--app-inset",
      "--app-ink",
      "--app-muted",
      "--app-line",
      "--app-control-line",
      "--app-primary",
      "--app-warm-accent",
      "--app-success",
      "--app-warning",
      "--app-danger",
      "--app-focus",
      "--app-shadow-card"
    ]) {
      expect(themeCss).toContain(token);
    }
  });

  it("keeps representative light and dark text combinations at WCAG AA contrast", () => {
    const combinations = [
      ["24302a", "fffefa"],
      ["59655f", "fffefa"],
      ["69746e", "fffefa"],
      ["ffffff", "315c4c"],
      ["ffffff", "a8433f"],
      ["32684d", "e0eee5"],
      ["805621", "f3e7d2"],
      ["a8433f", "f4e1de"],
      ["eff3ee", "1d2722"],
      ["b4bdb7", "1d2722"],
      ["9ca7a0", "202b25"],
      ["142019", "83b49b"],
      ["79b493", "243b30"],
      ["d0a260", "40351f"],
      ["e1847d", "482b29"]
    ];

    for (const [foreground, background] of combinations) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps field and button boundaries at non-text contrast", () => {
    expect(contrast("87938b", "fffefa")).toBeGreaterThanOrEqual(3);
    expect(contrast("65756b", "1d2722")).toBeGreaterThanOrEqual(3);
  });

  it("uses solid shared page and card surfaces and respects reduced motion", () => {
    expect(themeCss).toContain("background: var(--app-background)");
    expect(themeCss).not.toContain("radial-gradient");
    expect(themeCss).not.toContain("backdrop-blur");
    expect(themeCss).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
