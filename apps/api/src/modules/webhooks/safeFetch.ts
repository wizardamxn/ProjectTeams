import { lookup } from "node:dns";
import { BlockList, isIP } from "node:net";
import { Agent, request } from "undici";
import { config, isProd } from "../../config.js";

// Webhook URLs are typed in by users, so the server must never be tricked into
// calling its own network (cloud metadata, Redis, the database…). Addresses are
// checked when the connection is made, after DNS, so a hostname that resolves
// to a private address (or changes to one later) is refused too.

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** IPv4 inside IPv6 (::ffff:a.b.c.d, 64:ff9b::a.b.c.d) is judged as the IPv4 address. */
const embeddedV4 = (ip: string) => {
  const m = /^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  return m?.[1];
};

export const isPrivateAddress = (ip: string) => {
  const v4 = embeddedV4(ip);
  if (v4) return blocked.check(v4, "ipv4");
  const family = isIP(ip);
  if (family === 4) return blocked.check(ip, "ipv4");
  if (family === 6) return blocked.check(ip, "ipv6");
  return true; // not an IP at all: refuse
};

const allowPrivate = () => config.WEBHOOKS_ALLOW_PRIVATE;

export class UnsafeUrlError extends Error {}

/** Shape checks before anything goes on the network. */
export const assertSafeUrl = (raw: string) => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Enter a full URL, like https://example.com/hook");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && (!isProd || allowPrivate()))) {
    throw new UnsafeUrlError("Webhook URLs must use https://");
  }
  if (url.username || url.password) throw new UnsafeUrlError("Put credentials in the path or query, not before the host");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!allowPrivate() && (host === "localhost" || host.endsWith(".localhost") || (isIP(host) && isPrivateAddress(host)))) {
    throw new UnsafeUrlError("Webhook URLs can't point at private or local addresses");
  }
  return url;
};

const agent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, "", 4);
        const list = (Array.isArray(addresses) ? addresses : [addresses]) as { address: string; family: number }[];
        const bad = !allowPrivate() && list.some((a) => isPrivateAddress(a.address));
        if (bad || list.length === 0) return callback(new UnsafeUrlError("Webhook URL resolves to a private address"), "", 4);
        // Node asks for every address when `all` is set; hand them back the same way.
        if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: typeof list) => void)(null, list);
        callback(null, list[0]!.address, list[0]!.family);
      });
    },
  },
});

export interface PostResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
  durationMs: number;
}

/** POSTs JSON with a timeout and the address checks above. Redirects are not followed. */
export const safePost = async (url: string, body: string, headers: Record<string, string>, timeoutMs = 10_000): Promise<PostResult> => {
  const started = Date.now();
  try {
    assertSafeUrl(url);
    const res = await request(url, {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "user-agent": "ProjectTeams-Webhooks/1.0", ...headers },
      dispatcher: agent,
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
      signal: AbortSignal.timeout(timeoutMs),
    });
    await res.body.dump({ limit: 64 * 1024 }).catch(() => undefined);
    const ok = res.statusCode >= 200 && res.statusCode < 300;
    return { ok, statusCode: res.statusCode, ...(ok ? {} : { error: `HTTP ${res.statusCode}` }), durationMs: Date.now() - started };
  } catch (err) {
    const message = err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message) : String(err);
    return { ok: false, error: message.slice(0, 300), durationMs: Date.now() - started };
  }
};
