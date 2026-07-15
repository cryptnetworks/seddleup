import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "@/lib/csrf";

describe("CSRF origin checks", () => {
  it("allows same-origin requests", () => {
    const headers = new Headers({
      host: "triptally.test",
      origin: "https://triptally.test",
      "x-forwarded-proto": "https"
    });

    expect(isSameOriginRequest(headers)).toBe(true);
  });

  it("rejects cross-origin requests", () => {
    const headers = new Headers({
      host: "triptally.test",
      origin: "https://evil.example",
      "x-forwarded-proto": "https"
    });

    expect(isSameOriginRequest(headers)).toBe(false);
  });

  it("uses referer when origin is absent", () => {
    const headers = new Headers({
      host: "triptally.test",
      referer: "https://evil.example/form",
      "x-forwarded-proto": "https"
    });

    expect(isSameOriginRequest(headers)).toBe(false);
  });

  it("fails closed when both origin and referer are absent", () => {
    const headers = new Headers({
      host: "triptally.test",
      "x-forwarded-proto": "https"
    });

    expect(isSameOriginRequest(headers)).toBe(false);
  });
});
