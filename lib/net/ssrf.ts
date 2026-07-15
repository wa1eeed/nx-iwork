// SSRF guard for owner-supplied outbound URLs (the MCP server registry is the
// one place a tenant gives us a URL we then fetch server-side). Without this, an
// owner could point an "MCP server" at an internal service or the cloud metadata
// endpoint (169.254.169.254) and have our backend fetch it. We resolve DNS and
// reject any address in a private/reserved range — so a hostname that points at a
// private IP is caught too, not just IP literals.

import { lookup } from 'node:dns/promises';
import net from 'node:net';

const PRIVATE_V4 = [
  /^0\./, // "this" network
  /^10\./, // RFC1918
  /^127\./, // loopback
  /^169\.254\./, // link-local + cloud metadata (169.254.169.254)
  /^192\.168\./, // RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC1918 172.16–172.31
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64/10
];

function isPrivateV4(ip: string): boolean {
  return PRIVATE_V4.some((r) => r.test(ip));
}

function isPrivateV6(ip: string): boolean {
  const l = ip.toLowerCase();
  return (
    l === '::1' || // loopback
    l === '::' ||
    l.startsWith('fc') || // unique-local fc00::/7
    l.startsWith('fd') ||
    l.startsWith('fe80') || // link-local
    l.startsWith('::ffff:') // IPv4-mapped — check the embedded v4 below
  );
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateV4(ip);
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) → check the tail as v4.
  const mapped = ip.toLowerCase().startsWith('::ffff:') ? ip.slice(7) : '';
  if (mapped && net.isIPv4(mapped)) return isPrivateV4(mapped);
  return isPrivateV6(ip);
}

// Throws a short-coded Error when the URL isn't a safe public http(s) endpoint.
export async function assertPublicHttpUrl(raw: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('bad_url');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad_url');

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    throw new Error('blocked_host');
  }

  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('blocked_host');
    return;
  }

  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new Error('dns_failed');
  }
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error('blocked_host');
  }
}

// Boolean convenience for call sites that just want to skip a bad URL.
export async function isPublicHttpUrl(raw: string): Promise<boolean> {
  try {
    await assertPublicHttpUrl(raw);
    return true;
  } catch {
    return false;
  }
}
