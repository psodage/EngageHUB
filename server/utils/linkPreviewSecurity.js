import dns from "dns/promises";
import net from "net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
]);

function isPrivateIpv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIpv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (net.isIPv4(mapped)) return isPrivateIpv4(mapped);
  }
  return false;
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) return isPrivateIpv6(ip);
  return true;
}

function hostnameLooksPrivate(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (net.isIP(host)) return isPrivateIp(host);
  return false;
}

/**
 * Parse and validate a user-supplied URL for server-side fetching.
 * @returns {URL}
 */
export function parseAllowedUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("URL is required.");
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Invalid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URLs with credentials are not allowed.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new Error("Invalid URL host.");
  }

  if (hostnameLooksPrivate(hostname)) {
    throw new Error("This URL is not allowed.");
  }

  return parsed;
}

/**
 * Resolve hostname and reject private/reserved addresses (SSRF guard).
 */
export async function assertPublicResolvableUrl(parsedUrl) {
  const hostname = parsedUrl.hostname;

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error("This URL is not allowed.");
    }
    return;
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Could not resolve URL host.");
  }

  if (!addresses?.length) {
    throw new Error("Could not resolve URL host.");
  }

  for (const entry of addresses) {
    if (isPrivateIp(entry.address)) {
      throw new Error("This URL is not allowed.");
    }
  }
}
