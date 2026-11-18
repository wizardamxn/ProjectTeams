import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { isValidUpdate, jsonToState, replaceUpdate, stateToJson } from "../../src/modules/collab/collab.service.js";
import { formatBody, isRetryable, sign, summarize } from "../../src/modules/webhooks/webhooks.service.js";
import { assertSafeUrl, isPrivateAddress } from "../../src/modules/webhooks/safeFetch.js";

const p = (text: string, marks?: unknown[]) => ({ type: "paragraph", content: [{ type: "text", text, ...(marks ? { marks } : {}) }] });
const doc = (...content: unknown[]) => ({ type: "doc", content });

describe("collab state", () => {
  it("round-trips editor JSON, comment highlights included", () => {
    const json = doc(
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Plan" }] },
      p("note", [{ type: "comment", attrs: { commentId: "c1" } }]),
      { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [p("done")] }] },
    );
    expect(stateToJson(jsonToState(json))).toEqual(json);
  });

  it("falls back to plain paragraphs for content it doesn't know", () => {
    const out = stateToJson(jsonToState(doc({ type: "mystery", content: [{ type: "text", text: "kept" }] })));
    expect(JSON.stringify(out)).toContain("kept");
  });

  it("a replace update brings every copy to the new content", () => {
    const base = jsonToState(doc(p("old")));
    const a = new Y.Doc();
    const b = new Y.Doc();
    Y.applyUpdate(a, base);
    Y.applyUpdate(b, base);
    const update = replaceUpdate(base, doc(p("new"), p("second")));
    Y.applyUpdate(a, update);
    Y.applyUpdate(b, update);
    const want = doc(p("new"), p("second"));
    expect(stateToJson(Y.encodeStateAsUpdate(a))).toEqual(want);
    expect(stateToJson(Y.encodeStateAsUpdate(b))).toEqual(want);
  });

  it("concurrent edits from two people merge", () => {
    const base = jsonToState(doc(p("x")));
    const a = new Y.Doc();
    const b = new Y.Doc();
    Y.applyUpdate(a, base);
    Y.applyUpdate(b, base);
    const fa = a.getXmlFragment("default");
    const fb = b.getXmlFragment("default");
    const para = (text: string) => {
      const el = new Y.XmlElement("paragraph");
      el.insert(0, [new Y.XmlText(text)]);
      return el;
    };
    fa.insert(fa.length, [para("from A")]);
    fb.insert(fb.length, [para("from B")]);
    const merged = Y.mergeUpdates([base, Y.encodeStateAsUpdate(a), Y.encodeStateAsUpdate(b)]);
    const texts = JSON.stringify(stateToJson(merged));
    expect(texts).toContain("from A");
    expect(texts).toContain("from B");
  });

  it("rejects bytes that aren't an update", () => {
    expect(isValidUpdate(new Uint8Array([1, 2, 3, 250, 251]))).toBe(false);
    expect(isValidUpdate(new Uint8Array())).toBe(false);
    expect(isValidUpdate(jsonToState(doc(p("ok"))))).toBe(true);
  });
});

describe("webhook payloads", () => {
  const payload = (event: string, data: Record<string, unknown>) => ({ event, workspace: { name: "Acme <Co>" }, data });

  it("signs like Stripe: t=…,v1=HMAC(t.body)", () => {
    const expected = createHmac("sha256", "whsec_x").update('1700000000.{"a":1}').digest("hex");
    expect(sign("whsec_x", '{"a":1}', 1700000000)).toBe(`t=1700000000,v1=${expected}`);
  });

  it("Slack: escapes user text and links into the app", () => {
    const body = formatBody("slack", payload("message.created", { author: { name: "Ann" }, channel: { id: "c1", name: "general" }, message: { text: "<!channel> & hi" } })) as { text: string };
    expect(body.text).toContain("*Ann* in <http://localhost:8080/chat/c1|#general>: &lt;!channel&gt; &amp; hi");
  });

  it("Discord: no pings, links don't embed", () => {
    const body = formatBody("discord", payload("doc.created", { author: { name: "Ann" }, doc: { id: "d1", title: "Plan" } })) as {
      content: string;
      allowed_mentions: unknown;
    };
    expect(body.content).toBe("**Ann** created [Plan](<http://localhost:8080/editor/d1>)");
    expect(body.allowed_mentions).toEqual({ parse: [] });
  });

  it("JSON format sends the payload as is", () => {
    const pl = payload("member.joined", { member: { name: "Bo" } });
    expect(formatBody("json", pl)).toBe(pl);
    expect(summarize("member.joined", pl.data, "Acme", (u, l) => l, (s) => s)).toBe("Bo joined Acme");
  });

  it("retries network errors, 429 and 5xx only", () => {
    expect(isRetryable({ ok: false, durationMs: 1, error: "ECONNRESET" })).toBe(true);
    expect(isRetryable({ ok: false, durationMs: 1, statusCode: 503 })).toBe(true);
    expect(isRetryable({ ok: false, durationMs: 1, statusCode: 429 })).toBe(true);
    expect(isRetryable({ ok: false, durationMs: 1, statusCode: 404 })).toBe(false);
    expect(isRetryable({ ok: true, durationMs: 1, statusCode: 200 })).toBe(false);
  });
});

describe("webhook URL safety", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"])(
    "%s is private",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("%s is public", (ip) => expect(isPrivateAddress(ip)).toBe(false));

  it("refuses local hosts and junk", () => {
    expect(() => assertSafeUrl("http://localhost:2222/x")).toThrow(/private or local/);
    expect(() => assertSafeUrl("https://169.254.169.254/latest")).toThrow(/private or local/);
    expect(() => assertSafeUrl("https://[::1]/x")).toThrow(/private or local/);
    expect(() => assertSafeUrl("https://user:pw@example.com/x")).toThrow(/credentials/);
    expect(() => assertSafeUrl("ftp://example.com")).toThrow(/https/);
    expect(() => assertSafeUrl("not a url")).toThrow(/full URL/);
    expect(assertSafeUrl("https://hooks.slack.com/services/T/B/x").hostname).toBe("hooks.slack.com");
  });
});
