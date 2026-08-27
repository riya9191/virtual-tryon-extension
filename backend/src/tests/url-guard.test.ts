import { describe, expect, it } from "vitest";

import { assertUrlIsFetchable, BlockedUrlError, isPublicAddress, parseAllowedHosts } from "../services/url-guard.js";

const AMAZON = ["m.media-amazon.com"];

async function expectBlocked(url: string, allowedHosts: string[] = AMAZON): Promise<string> {
  try {
    await assertUrlIsFetchable(url, allowedHosts);
  } catch (error) {
    expect(error).toBeInstanceOf(BlockedUrlError);
    expect((error as BlockedUrlError).statusCode).toBe(400);
    return (error as Error).message;
  }
  throw new Error(`expected ${url} to be blocked`);
}

describe("url-guard", () => {
  it("rejects non-https schemes", async () => {
    expect(await expectBlocked("http://m.media-amazon.com/a.png")).toContain("https");
    expect(await expectBlocked("file:///etc/passwd", [])).toContain("https");
  });

  it("rejects embedded credentials", async () => {
    const message = await expectBlocked("https://user:pass@m.media-amazon.com/a.png");
    expect(message).toContain("credentials");
  });

  it("rejects hosts outside the allowlist", async () => {
    expect(await expectBlocked("https://evil.example.com/a.png")).toContain("not allowed");
  });

  it("accepts subdomains of an allowlisted host", async () => {
    const url = await assertUrlIsFetchable("https://1.2.3.4/a.png", ["1.2.3.4"]);
    expect(url.hostname).toBe("1.2.3.4");
  });

  it("blocks private and metadata IP literals even with an open allowlist", async () => {
    for (const host of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "[::1]"]) {
      expect(await expectBlocked(`https://${host}/a.png`, [])).toContain("non-public");
    }
  });

  it("blocks internal-sounding names before touching DNS", async () => {
    expect(await expectBlocked("https://localhost/a.png", [])).toContain("not allowed");
    expect(await expectBlocked("https://db.internal/a.png", [])).toContain("not allowed");
  });

  it("classifies address ranges", () => {
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("93.184.216.34")).toBe(true);
    expect(isPublicAddress("2606:2800:220:1::1")).toBe(true);

    expect(isPublicAddress("0.0.0.0")).toBe(false);
    expect(isPublicAddress("100.64.0.1")).toBe(false); // CGNAT
    expect(isPublicAddress("224.0.0.1")).toBe(false); // multicast
    expect(isPublicAddress("::ffff:127.0.0.1")).toBe(false); // IPv4-mapped loopback
    expect(isPublicAddress("fd00::1")).toBe(false); // unique local
    expect(isPublicAddress("fe80::1")).toBe(false); // link-local
    expect(isPublicAddress("not-an-ip")).toBe(false);
  });

  it("parses allowlist configuration", () => {
    expect(parseAllowedHosts(undefined).length).toBeGreaterThan(0);
    expect(parseAllowedHosts("")).toEqual([]);
    expect(parseAllowedHosts(" A.com , b.com ")).toEqual(["a.com", "b.com"]);
  });
});
