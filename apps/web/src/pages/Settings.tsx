import { Tip } from "@/components/ui/tooltip";
import { useState, type ReactNode } from "react";
import { Select } from "@/components/ui/select";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Activity, AlertTriangle, Download, Loader2, Settings as SettingsIcon, Trash2, X, Zap } from "@/components/icons";
import { Integrations } from "@/components/settings/Integrations";
import { downloadAuditCsv, exportUrl, useAuditLog, useDeleteWorkspace, useMembers } from "@/api/workspaces";
import { AUDIT_ACTIONS, type AuditAction, type AuditEvent, type AuditFilter } from "@/api/types";
import { errorMessage } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";
import { isAtLeast } from "@/store/slices/User";

type Tab = "general" | "integrations" | "audit";

export default function Settings() {
  const role = useAppSelector((s) => s.user.role);
  const isAdmin = isAtLeast(role, "admin");
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: Tab = isAdmin && (requested === "audit" || requested === "integrations") ? requested : "general";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <span className="text-sm font-semibold uppercase tracking-widest text-emerald-500">Settings</span>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Workspace settings</h1>
      </div>

      {isAdmin && (
        <div role="tablist" className="mb-6 flex gap-1 border-b border-white/[0.08]">
          {(
            [
              ["general", "General", SettingsIcon],
              ["integrations", "Integrations", Zap],
              ["audit", "Audit log", Activity],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setParams(id === "general" ? {} : { tab: id }, { replace: true })}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === id ? "border-emerald-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      )}

      {tab === "audit" ? <AuditLog /> : tab === "integrations" ? <Integrations /> : <General />}
    </div>
  );
}

/* ---------------- General ---------------- */

const Card = ({ title, children, danger }: { title: string; children: ReactNode; danger?: boolean }) => (
  <section className={`rounded-2xl border p-5 ${danger ? "border-red-500/25 bg-red-500/[0.03]" : "border-white/[0.08] bg-zinc-900/40"}`}>
    <h2 className={`mb-1 text-base font-semibold ${danger ? "text-red-400" : "text-white"}`}>{title}</h2>
    {children}
  </section>
);

const DownloadLink = ({ href, children, primary }: { href: string; children: ReactNode; primary?: boolean }) => (
  <a
    href={href}
    download
    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      primary ? "bg-emerald-600 text-white hover:bg-emerald-500" : "border border-white/10 text-zinc-200 hover:bg-zinc-800"
    }`}
  >
    <Download className="h-4 w-4" /> {children}
  </a>
);

function General() {
  const role = useAppSelector((s) => s.user.role);
  const workspace = useAppSelector((s) => s.user.workspace);
  const isAdmin = isAtLeast(role, "admin");
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="space-y-5">
      {isAdmin && (
        <Card title="Export this workspace">
          <p className="mb-4 text-sm text-zinc-400">
            A zip with every doc (as Markdown), public channel history, the member list and Knowledge files. Private channels and
            direct messages are not included.
          </p>
          <div className="flex flex-wrap gap-2">
            <DownloadLink href={exportUrl("workspace")} primary>
              Download everything
            </DownloadLink>
            <DownloadLink href={exportUrl("workspace", { files: false })}>Without files (smaller)</DownloadLink>
          </div>
        </Card>
      )}

      <Card title="Your data">
        <p className="mb-4 text-sm text-zinc-400">
          Your profile, the docs you wrote and every message you've sent, including direct messages, across all your workspaces.
        </p>
        <DownloadLink href={exportUrl("me")}>Download my data</DownloadLink>
      </Card>

      {role === "owner" && (
        <Card title="Delete workspace" danger>
          <p className="mb-4 text-sm text-zinc-400">
            Permanently deletes <span className="font-medium text-zinc-200">{workspace?.name}</span> for everyone: docs, chats, files
            and the audit log. This can't be undone, so export first if you might need anything.
          </p>
          <button
            onClick={() => setDeleting(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" /> Delete workspace
          </button>
        </Card>
      )}

      {deleting && workspace && <DeleteDialog name={workspace.name} onClose={() => setDeleting(false)} />}
    </div>
  );
}

function DeleteDialog({ name, onClose }: { name: string; onClose: () => void }) {
  const navigate = useNavigate();
  const del = useDeleteWorkspace();
  const [typed, setTyped] = useState("");
  const matches = typed === name;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matches) return;
    del.mutate(typed, {
      onSuccess: () => {
        toast.success(`${name} was deleted`);
        navigate("/dashboard", { replace: true });
      },
      onError: (err) => toast.error(errorMessage(err, "Couldn't delete the workspace")),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="delete-title" className="flex items-center gap-2 text-lg font-semibold text-white">
            <AlertTriangle className="h-5 w-5 text-red-400" /> Delete {name}?
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-sm text-zinc-400">
          Everyone loses access immediately and all of its content is deleted for good.
        </p>
        <label className="mb-1.5 block text-sm text-zinc-300" htmlFor="confirm-name">
          Type <span className="font-semibold text-white">{name}</span> to confirm
        </label>
        <input
          id="confirm-name"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          autoComplete="off"
          className="mb-4 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-500/50"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!matches || del.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {del.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Delete forever
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- Audit log ---------------- */

const ACTION_LABELS: Record<AuditAction, string> = {
  "workspace.renamed": "Workspace renamed",
  "workspace.exported": "Workspace exported",
  "member.joined": "Member joined",
  "member.left": "Member left",
  "member.removed": "Member removed",
  "member.role_changed": "Role changed",
  "ownership.transferred": "Ownership transferred",
  "invite.created": "Invite created",
  "invite.revoked": "Invite revoked",
  "channel.created": "Channel created",
  "channel.renamed": "Channel renamed",
  "doc.deleted": "Doc deleted",
  "doc.version_restored": "Doc version restored",
  "folder.deleted": "Folder deleted",
  "file.uploaded": "File uploaded",
  "file.deleted": "File deleted",
  "webhook.created": "Webhook added",
  "webhook.updated": "Webhook changed",
  "webhook.deleted": "Webhook deleted",
};

const str = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));

/** "renamed the workspace from A to B" — the sentence after the actor's name. */
const describeEvent = (e: AuditEvent): string => {
  const t = e.target?.label ?? "";
  const m = e.meta ?? {};
  switch (e.action) {
    case "workspace.renamed":
      return `renamed the workspace from "${str(m.from)}" to "${str(m.to)}"`;
    case "workspace.exported":
      return m.files === false ? "exported the workspace (without files)" : "exported the workspace";
    case "member.joined":
      return `joined as ${str(m.role) || "a member"}${m.via ? ` through an ${str(m.via)}` : ""}`;
    case "member.left":
      return "left the workspace";
    case "member.removed":
      return `removed ${t}`;
    case "member.role_changed":
      return `changed ${t} from ${str(m.from)} to ${str(m.to)}`;
    case "ownership.transferred":
      return `made ${t} the owner`;
    case "invite.created":
      return t && t !== "Invite link" ? `invited ${t} as ${str(m.role)}` : `created an invite link for ${str(m.role)}s`;
    case "invite.revoked":
      return t && t !== "Invite link" ? `revoked the invite for ${t}` : "revoked an invite link";
    case "channel.created":
      return `created ${m.private ? "the private channel " : ""}${t}`;
    case "channel.renamed":
      return `renamed ${str(m.from)} to ${t}`;
    case "doc.deleted":
      return `deleted the doc "${t}"`;
    case "doc.version_restored":
      return `restored an older version of "${t}"`;
    case "folder.deleted":
      return `deleted the folder "${t}"`;
    case "file.uploaded":
      return `uploaded ${t}`;
    case "file.deleted":
      return `deleted ${t}`;
    case "webhook.created":
      return `added the webhook "${t}"${m.url ? ` (${str(m.url)})` : ""}`;
    case "webhook.updated":
      return Array.isArray(m.changed) && m.changed.length === 1 && m.changed[0] === "secret" ? `rotated the secret of "${t}"` : `changed the webhook "${t}"`;
    case "webhook.deleted":
      return `deleted the webhook "${t}"`;
  }
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const selectCls = "min-w-40 text-zinc-200";

function AuditLog() {
  const [filter, setFilter] = useState<AuditFilter>({});
  const { data: members = [] } = useMembers();
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useAuditLog(filter);
  const [downloading, setDownloading] = useState(false);
  const events = data?.pages.flatMap((p) => p.items) ?? [];

  const onCsv = async () => {
    setDownloading(true);
    try {
      await downloadAuditCsv(filter);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't download the log"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filter by action"
          value={filter.action ?? ""}
          onChange={(v) => setFilter((f) => ({ ...f, action: (v || undefined) as AuditAction | undefined }))}
          options={[{ value: "", label: "All actions" }, ...AUDIT_ACTIONS.map((a) => ({ value: a, label: ACTION_LABELS[a] }))]}
          className={selectCls}
        />
        <Select
          aria-label="Filter by person"
          value={filter.actorId ?? ""}
          onChange={(v) => setFilter((f) => ({ ...f, actorId: v || undefined }))}
          options={[{ value: "", label: "Everyone" }, ...members.map((m) => ({ value: m._id, label: m.fullName }))]}
          className={selectCls}
        />
        <button
          onClick={onCsv}
          disabled={downloading}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download CSV
        </button>
      </div>

      {isLoading ? (
        <Loader2 className="mx-auto mt-10 h-5 w-5 animate-spin text-zinc-600" />
      ) : isError ? (
        <p className="text-sm text-red-400">{errorMessage(error, "Couldn't load the audit log")}</p>
      ) : events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
          {filter.action || filter.actorId ? "Nothing matches these filters." : "Nothing recorded yet."}
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08]">
          {events.map((e) => (
            <li key={e._id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              <p className="min-w-0 flex-1 text-sm text-zinc-300">
                <span className="font-medium text-white">{e.actor.name}</span> {describeEvent(e)}
              </p>
              <Tip label={e.ip ? `From ${e.ip}` : undefined}><span className="shrink-0 text-xs text-zinc-500">
                {formatTime(e.createdAt)}
              </span></Tip>
            </li>
          ))}
        </ul>
      )}

      {hasNextPage && (
        <div className="mt-4 text-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />} Load older
          </button>
        </div>
      )}
      <p className="mt-4 text-xs text-zinc-600">Events are kept for a year.</p>
    </div>
  );
}
