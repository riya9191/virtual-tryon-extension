import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Raised when a caller-supplied URL is rejected before any network request is
 * made. Carries a 4xx status because the client sent something invalid.
 */
export class BlockedUrlError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

/**
 * Image CDNs used by the marketplaces this extension supports. The content
 * script only runs on Amazon, so the default surface is deliberately narrow.
 */
export const DEFAULT_ALLOWED_IMAGE_HOSTS = [
  "m.media-amazon.com",
  "images-na.ssl-images-amazon.com",
  "images-eu.ssl-images-amazon.com",
  "images-fe.ssl-images-amazon.com",
];

export function parseAllowedHosts(raw: string | undefined): string[] {
  if (raw === undefined) return [...DEFAULT_ALLOWED_IMAGE_HOSTS];
  return raw
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Validates a caller-supplied product image URL.
 *
 * Two independent layers, because each covers a different attack:
 *  1. Host allowlist — stops the server being used as an open proxy at all.
 *  2. DNS resolution + private-range check — stops DNS rebinding and SSRF
 *     against loopback, RFC1918 and cloud metadata endpoints (169.254.169.254)
 *     when the operator has widened the allowlist.
 */
export async function assertUrlIsFetchable(rawUrl: string, allowedHosts: string[]): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError("product_image_url is not a valid URL");
  }

  if (url.protocol !== "https:") {
    throw new BlockedUrlError("product_image_url must use https");
  }

  if (url.username || url.password) {
    throw new BlockedUrlError("product_image_url must not contain credentials");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (allowedHosts.length > 0 && !isHostAllowed(hostname, allowedHosts)) {
    throw new BlockedUrlError(`product image host "${hostname}" is not allowed`);
  }

  // An IP literal never needs DNS, but it does need range checking.
  if (isIP(hostname)) {
    assertPublicAddress(hostname, hostname);
    return url;
  }

  if (isBlockedName(hostname)) {
    throw new BlockedUrlError(`product image host "${hostname}" is not allowed`);
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new BlockedUrlError(`product image host "${hostname}" could not be resolved`);
  }

  if (addresses.length === 0) {
    throw new BlockedUrlError(`product image host "${hostname}" could not be resolved`);
  }

  // Every resolved address must be public; one private answer is enough to
  // make the whole name untrustworthy.
  for (const { address } of addresses) {
    assertPublicAddress(address, hostname);
  }

  return url;
}

function isHostAllowed(hostname: string, allowedHosts: string[]): boolean {
  return allowedHosts.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
}

function isBlockedName(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  );
}

function assertPublicAddress(address: string, hostname: string): void {
  if (!isPublicAddress(address)) {
    throw new BlockedUrlError(`product image host "${hostname}" resolves to a non-public address`);
  }
}

export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPublicIpv4(address);
  if (version === 6) return isPublicIpv6(address);
  return false;
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = octets as [number, number, number, number];

  if (a === 0) return false; // "this" network
  if (a === 10) return false; // RFC1918
  if (a === 127) return false; // loopback
  if (a === 169 && b === 254) return false; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // RFC1918
  if (a === 192 && b === 0) return false; // IETF protocol assignments
  if (a === 192 && b === 168) return false; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a >= 224) return false; // multicast and reserved

  return true;
}

function isPublicIpv6(address: string): boolean {
  const value = address.toLowerCase().split("%")[0] ?? "";

  if (value === "::" || value === "::1") return false;

  // IPv4-mapped (::ffff:1.2.3.4) and IPv4-compatible forms defer to the v4 rules.
  const embedded = value.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (embedded?.[1]) return isPublicIpv4(embedded[1]);

  const head = value.split(":")[0] ?? "";
  if (head.length === 0) return false;

  const group = Number.parseInt(head.padStart(4, "0"), 16);
  if (Number.isNaN(group)) return false;

  if ((group & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((group & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((group & 0xff00) === 0xff00) return false; // ff00::/8 multicast

  return true;
}
