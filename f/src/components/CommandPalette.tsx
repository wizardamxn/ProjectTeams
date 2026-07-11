import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import axios from "axios";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Users,
  Database,
  User,
  Plus,
  UserPlus,
  LogOut,
  CornerDownLeft,
} from "@/components/icons";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { logout } from "@/store/slices/User";

interface DocLite {
  _id: string;
  title: string;
}
interface MemberLite {
  _id: string;
  fullName: string;
  email: string;
}

/**
 * ⌘K / Ctrl-K command palette. Opens via keyboard, or by dispatching a
 * window "open-cmdk" event (used by the sidebar search button).
 * Navigates pages, jumps to team documents, and starts DMs with teammates.
 */
export default function CommandPalette() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const backendURL = import.meta.env.VITE_BACKEND_URL;

  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<DocLite[]>([]);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Keyboard + custom-event triggers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onEvent = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("open-cmdk", onEvent as EventListener);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("open-cmdk", onEvent as EventListener);
    };
  }, []);

  // Lazy-load docs + members the first time the palette opens
  useEffect(() => {
    if (!open || loaded) return;
    let active = true;
    (async () => {
      try {
        const [d, m] = await Promise.allSettled([
          axios.get(`${backendURL}/api/doc/teamdocs`, { withCredentials: true }),
          axios.get(`${backendURL}/api/profile/teammembers`, {
            withCredentials: true,
          }),
        ]);
        if (!active) return;
        if (d.status === "fulfilled") setDocs(d.value.data ?? []);
        if (m.status === "fulfilled") setMembers(m.value.data ?? []);
        setLoaded(true);
      } catch {
        /* palette still works for navigation without this data */
      }
    })();
    return () => {
      active = false;
    };
  }, [open, loaded, backendURL]);

  const run = useCallback((fn: () => void) => {
    setOpen(false);
    // let the dialog close before navigating for a smoother transition
    setTimeout(fn, 0);
  }, []);

  const handleLogout = async () => {
    try {
      await axios.post(
        `${backendURL}/api/auth/logout`,
        {},
        { withCredentials: true },
      );
    } catch {
      /* ignore */
    }
    dispatch(logout());
    navigate("/login", { replace: true });
  };

  const nav = [
    { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
    { label: "Documents", icon: FileText, to: "/documents" },
    { label: "Chat", icon: MessageSquare, to: "/chat" },
    { label: "Team", icon: Users, to: "/team" },
    { label: "RAG Docs", icon: Database, to: "/rag-docs" },
    { label: "Profile", icon: User, to: "/profile" },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or jump to…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {nav.map((item) => (
            <CommandItem
              key={item.to}
              value={`nav ${item.label}`}
              onSelect={() => run(() => navigate(item.to))}
            >
              <item.icon className="mr-2 h-4 w-4 text-emerald-400" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Actions">
          <CommandItem
            value="new document create"
            onSelect={() => run(() => navigate("/create"))}
          >
            <Plus className="mr-2 h-4 w-4 text-emerald-400" />
            New document
          </CommandItem>
          <CommandItem
            value="invite member team"
            onSelect={() => run(() => navigate("/team"))}
          >
            <UserPlus className="mr-2 h-4 w-4 text-emerald-400" />
            Invite a teammate
          </CommandItem>
        </CommandGroup>

        {docs.length > 0 && (
          <CommandGroup heading="Documents">
            {docs.slice(0, 8).map((doc) => (
              <CommandItem
                key={doc._id}
                value={`doc ${doc.title}`}
                onSelect={() => run(() => navigate(`/editor/${doc._id}`))}
              >
                <FileText className="mr-2 h-4 w-4 text-zinc-500" />
                <span className="truncate">{doc.title}</span>
                <CornerDownLeft className="ml-auto h-3 w-3 text-zinc-600" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {members.length > 0 && (
          <CommandGroup heading="People">
            {members.slice(0, 8).map((m) => (
              <CommandItem
                key={m._id}
                value={`person ${m.fullName} ${m.email}`}
                onSelect={() => run(() => navigate(`/chat/${m._id}`))}
              >
                <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/80 to-teal-600/80 text-[10px] font-semibold text-white">
                  {m.fullName?.charAt(0)?.toUpperCase()}
                </span>
                <span className="truncate">{m.fullName}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Account">
          <CommandItem
            value="logout sign out"
            onSelect={() => run(handleLogout)}
            className="text-red-400 data-[selected=true]:bg-red-500/10 data-[selected=true]:text-red-400"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
