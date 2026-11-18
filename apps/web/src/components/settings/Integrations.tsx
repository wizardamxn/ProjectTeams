import { confirmDialog } from "@/components/ui/confirm";
import { Select } from "@/components/ui/select";
import { Checkbox, Switch } from "@/components/ui/checkbox";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, KeyRound, Loader2, Plus, Send, Trash2, X, XCircle } from "@/components/icons";
import {
  useCreateWebhook,
  useDeleteWebhook,
  useRotateWebhookSecret,
  useTestWebhook,
  useUpdateWebhook,
  useWebhookDeliveries,
  useWebhooks,
} from "@/api/workspaces";
import { WEBHOOK_EVENTS, type Webhook, type WebhookEvent, type WebhookFormat } from "@/api/types";
import { errorMessage } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";

const EVENT_LABELS: Record<WebhookEvent, string> = {
  "message.created": "New message in a public channel",
  "doc.created": "Doc created",
  "doc.deleted": "Doc deleted",
  "comment.created": "Comment on a doc",
  "member.joined": "Someone joins the workspace",
  "file.uploaded": "File added to Knowledge",
};

const FORMATS: { id: WebhookFormat; label: string; hint: string }[] = [
  { id: "slack", label: "Slack", hint: "A Slack incoming webhook URL (hooks.slack.com/services/…)" },
  { id: "discord", label: "Discord", hint: "A Discord channel webhook URL (discord.com/api/webhooks/…)" },
  { id: "json", label: "Custom (JSON)", hint: "Your own endpoint. Each request is signed; see the secret below." },
];

const inputCls = "w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50";

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  } catch {
    toast.error("Couldn't copy");
  }
};

/** Shown once, right after creating a hook or rotating its secret. */
function SecretNotice({ secret, onClose }: { secret: string; onClose: () => void }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-amber-300">Signing secret</p>
        <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-white" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-3 text-xs text-zinc-400">
        Copy it now; it won't be shown in full again. Check each request's <code className="text-zinc-300">X-ProjectTeams-Signature</code> header:{" "}
        <code className="text-zinc-300">t=…,v1=HMAC-SHA256(secret, "t.body")</code>.
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200">{secret}</code>
        <button onClick={() => copy(secret)} className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800">
          <Copy className="h-3.5 w-3.5" /> Copy
        </button>
      </div>
    </div>
  );
}

function HookForm({ initial, onDone, onSecret }: { initial?: Webhook; onDone: () => void; onSecret: (s: string) => void }) {
  const create = useCreateWebhook();
  const update = useUpdateWebhook();
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [format, setFormat] = useState<WebhookFormat>(initial?.format ?? "slack");
  const [events, setEvents] = useState<WebhookEvent[]>(initial?.events ?? ["message.created", "doc.created"]);
  const busy = create.isPending || update.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = { name: name.trim(), url: url.trim(), format, events };
    if (initial) {
      update.mutate({ id: initial._id, ...input }, { onSuccess: onDone, onError: (err) => toast.error(errorMessage(err, "Couldn't save")) });
    } else {
      create.mutate(input, {
        onSuccess: (hook) => {
          onSecret(hook.secret);
          onDone();
          toast.success("Webhook added. Send a test to check it.");
        },
        onError: (err) => toast.error(errorMessage(err, "Couldn't add the webhook")),
      });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-zinc-300">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="#announcements in Slack" className={inputCls} required />
        </label>
        <div>
          <span className="mb-1.5 block text-sm text-zinc-300">Send to</span>
          <Select
            value={format}
            onChange={setFormat}
            options={FORMATS.map((f) => ({ value: f.id, label: f.label }))}
            aria-label="Send to"
            className="w-full"
          />
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm text-zinc-300">Webhook URL</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" placeholder="https://" className={inputCls} required />
        <span className="mt-1 block text-xs text-zinc-500">{FORMATS.find((f) => f.id === format)?.hint}</span>
      </label>
      <fieldset>
        <legend className="mb-2 text-sm text-zinc-300">Events</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {WEBHOOK_EVENTS.map((ev) => (
            <label key={ev} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <Checkbox
                checked={events.includes(ev)}
                onChange={(on) => setEvents((list) => (on ? [...list, ev] : list.filter((x) => x !== ev)))}
              />
              {EVENT_LABELS[ev]}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">Messages from private channels and DMs are never sent.</p>
      </fieldset>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !name.trim() || !url.trim() || events.length === 0}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {initial ? "Save" : "Add webhook"}
        </button>
      </div>
    </form>
  );
}

function Deliveries({ id }: { id: string }) {
  const { data = [], isLoading } = useWebhookDeliveries(id);
  if (isLoading) return <Loader2 className="mx-auto my-3 h-4 w-4 animate-spin text-zinc-600" />;
  if (data.length === 0) return <p className="py-3 text-xs text-zinc-500">No deliveries yet.</p>;
  return (
    <ul className="divide-y divide-white/[0.04] text-xs">
      {data.map((d) => (
        <li key={d._id} className="flex items-center gap-2 py-1.5">
          {d.status === "success" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
          <span className="text-zinc-300">{d.event}</span>
          <span className="text-zinc-500">{d.statusCode ?? d.error ?? ""}</span>
          {d.attempt > 1 && <span className="text-zinc-600">try {d.attempt}</span>}
          <span className="ml-auto text-zinc-500">{formatRelativeTime(d.createdAt)} · {d.durationMs} ms</span>
        </li>
      ))}
    </ul>
  );
}

function HookRow({ hook, onEdit, onSecret }: { hook: Webhook; onEdit: () => void; onSecret: (s: string) => void }) {
  const update = useUpdateWebhook();
  const del = useDeleteWebhook();
  const test = useTestWebhook();
  const rotate = useRotateWebhookSecret();
  const [showLog, setShowLog] = useState(false);

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium text-white">
            {hook.name}
            <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-zinc-400">{hook.format}</span>
            {!hook.enabled && <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-normal text-zinc-400">Off</span>}
          </p>
          <p className="truncate text-xs text-zinc-500">{hook.url}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {hook.events.map((e) => EVENT_LABELS[e]).join(" · ")}
            {hook.lastDeliveryAt && (
              <span className={hook.lastStatus === "failed" ? "text-red-400" : ""}>
                {" "}· last {hook.lastStatus === "failed" ? "failed" : "sent"} {formatRelativeTime(hook.lastDeliveryAt)}
              </span>
            )}
          </p>
          {hook.disabledReason && <p className="mt-1 text-xs text-amber-400">{hook.disabledReason}. Fix the URL, then turn it back on.</p>}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
          <Switch
            checked={hook.enabled}
            onChange={(on) => update.mutate({ id: hook._id, enabled: on }, { onError: (err) => toast.error(errorMessage(err, "Couldn't update")) })}
          />
          On
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        <button
          onClick={() =>
            test.mutate(hook._id, {
              onSuccess: (r) =>
                r.ok ? toast.success(`Test delivered (${r.statusCode}, ${r.durationMs} ms)`) : toast.error(`Test failed: ${r.error ?? r.statusCode}`),
              onError: (err) => toast.error(errorMessage(err, "Couldn't send a test")),
            })
          }
          disabled={test.isPending}
          className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-zinc-200 hover:bg-zinc-800"
        >
          {test.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Send test
        </button>
        <button onClick={() => setShowLog((v) => !v)} className="rounded-md border border-white/10 px-2 py-1 text-zinc-200 hover:bg-zinc-800">
          {showLog ? "Hide" : "Recent"} deliveries
        </button>
        <button onClick={onEdit} className="rounded-md border border-white/10 px-2 py-1 text-zinc-200 hover:bg-zinc-800">
          Edit
        </button>
        {hook.format === "json" && (
          <button
            onClick={async () =>
              (await confirmDialog({
                title: "Make a new signing secret?",
                body: "The old one stops working right away.",
                action: "Make new secret",
                danger: true,
              })) &&
              rotate.mutate(hook._id, { onSuccess: (h) => onSecret(h.secret), onError: (err) => toast.error(errorMessage(err, "Couldn't rotate")) })
            }
            className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-zinc-200 hover:bg-zinc-800"
          >
            <KeyRound className="h-3 w-3" /> New secret
          </button>
        )}
        <button
          onClick={async () =>
            (await confirmDialog({ title: `Delete "${hook.name}"?`, action: "Delete", danger: true })) && del.mutate(hook._id, { onError: (err) => toast.error(errorMessage(err, "Couldn't delete")) })}
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-zinc-500 hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </div>
      {showLog && (
        <div className="mt-3 rounded-lg border border-white/[0.06] px-3">
          <Deliveries id={hook._id} />
        </div>
      )}
    </li>
  );
}

export function Integrations() {
  const { data: hooks = [], isLoading } = useWebhooks();
  const [editing, setEditing] = useState<Webhook | "new" | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Webhooks</h2>
          <p className="text-sm text-zinc-400">Post workspace activity to Slack, Discord, or your own service.</p>
        </div>
        {!editing && hooks.length < 10 && (
          <button
            onClick={() => setEditing("new")}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" /> Add webhook
          </button>
        )}
      </div>

      {secret && <SecretNotice secret={secret} onClose={() => setSecret(null)} />}
      {editing && <HookForm initial={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} onSecret={setSecret} />}

      {isLoading ? (
        <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-zinc-600" />
      ) : hooks.length === 0 ? (
        !editing && (
          <p className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
            No webhooks yet. Add one to get new docs and messages in Slack or Discord.
          </p>
        )
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08]">
          {hooks.map((h) => (
            <HookRow key={h._id} hook={h} onEdit={() => setEditing(h)} onSecret={setSecret} />
          ))}
        </ul>
      )}
    </div>
  );
}
