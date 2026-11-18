import { useState } from "react";
import { Edit, FileText, Plus, Star, Trash2, X } from "@/components/icons";
import type { Folder } from "@/api/types";

export type View = { kind: "all" } | { kind: "starred" } | { kind: "unfiled" } | { kind: "folder"; id: string };

const chip = (active: boolean) =>
  `flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
    active ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
  }`;

/** All · Starred · No folder · each folder (with rename/delete when selected) · New folder. */
export function FolderBar({
  view,
  onView,
  folders,
  onCreate,
  onRename,
  onDelete,
}: {
  view: View;
  onView: (v: View) => void;
  folders: Folder[];
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const current = view.kind === "folder" ? folders.find((f) => f._id === view.id) : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onCreate(name.trim());
    setName("");
    setAdding(false);
  };

  return (
    <div className="mb-6">
      <div className="custom-scrollbar flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter documents">
        <button role="tab" aria-selected={view.kind === "all"} className={chip(view.kind === "all")} onClick={() => onView({ kind: "all" })}>
          <FileText className="h-3.5 w-3.5" /> All
        </button>
        <button role="tab" aria-selected={view.kind === "starred"} className={chip(view.kind === "starred")} onClick={() => onView({ kind: "starred" })}>
          <Star className="h-3.5 w-3.5" /> Starred
        </button>
        {folders.length > 0 && (
          <button role="tab" aria-selected={view.kind === "unfiled"} className={chip(view.kind === "unfiled")} onClick={() => onView({ kind: "unfiled" })}>
            No folder
          </button>
        )}
        <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />
        {folders.map((f) => (
          <button
            key={f._id}
            role="tab"
            aria-selected={view.kind === "folder" && view.id === f._id}
            className={chip(view.kind === "folder" && view.id === f._id)}
            onClick={() => onView({ kind: "folder", id: f._id })}
          >
            {f.name} <span className="text-xs opacity-60">{f.docCount}</span>
          </button>
        ))}
        {adding ? (
          <form onSubmit={submit} className="flex shrink-0 items-center gap-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => !name && setAdding(false)}
              maxLength={60}
              placeholder="Folder name"
              aria-label="New folder name"
              className="w-36 rounded-full border border-emerald-500/40 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 outline-none"
            />
            <button type="button" onClick={() => setAdding(false)} className="rounded-full p-1 text-zinc-500 hover:text-white" aria-label="Cancel">
              <X className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <button className={chip(false)} onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> New folder
          </button>
        )}
      </div>

      {current && (
        <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
          <button
            onClick={() => {
              const next = window.prompt("Rename folder", current.name);
              if (next?.trim() && next.trim() !== current.name) onRename(current._id, next.trim());
            }}
            className="flex items-center gap-1 hover:text-zinc-200"
          >
            <Edit className="h-3.5 w-3.5" /> Rename
          </button>
          <button
            onClick={() => confirm(`Delete the folder "${current.name}"? Its documents stay, without a folder.`) && onDelete(current._id)}
            className="flex items-center gap-1 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete folder
          </button>
        </div>
      )}
    </div>
  );
}
