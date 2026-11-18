import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";
import { useLogout } from "@/api/auth";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Users,
  Database,
  Settings,
  User,
  LogOut,
  Search,
  Command as CommandIcon,
} from "@/components/icons";

import {
  SidebarProvider,
  SidebarBody,
  SidebarLink,
  useSidebar,
} from "@/components/ace/expandable-sidebar";
import { FloatingDock, type DockItem } from "@/components/ace/floating-dock";
import CommandPalette from "@/components/CommandPalette";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import NotificationsBell from "@/components/NotificationsBell";
import { useRealtime } from "@/api/realtime";
import { useConversations } from "@/api/chat";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Documents", icon: FileText, path: "/documents" },
  { label: "Chat", icon: MessageSquare, path: "/chat" },
  { label: "Team", icon: Users, path: "/team" },
  { label: "Knowledge", icon: Database, path: "/knowledge" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

const openPalette = () => window.dispatchEvent(new Event("open-cmdk"));

/* ---- Workspace switcher at the top of the rail (initial only when collapsed) ---- */
const RailBrand = () => {
  const { open } = useSidebar();
  return (
    <div className="mb-5">
      <WorkspaceSwitcher compact={!open} />
    </div>
  );
};

/* ---- Search button styled like a nav link ---- */
const RailSearch = () => {
  const { open } = useSidebar();
  return (
    <button
      onClick={openPalette}
      className="group mb-2 flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2.5 text-zinc-400 transition-colors hover:border-emerald-500/20 hover:text-zinc-100"
    >
      <Search className="h-5 w-5 shrink-0" />
      <span
        className="flex flex-1 items-center overflow-hidden whitespace-nowrap text-sm"
        style={{ opacity: open ? 1 : 0, width: open ? "auto" : 0 }}
      >
        Search
        <kbd className="ml-auto flex items-center gap-0.5 rounded border border-white/10 bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
          <CommandIcon className="h-2.5 w-2.5" />K
        </kbd>
      </span>
    </button>
  );
};

/* ---- User footer (avatar + name, reveals on expand) ---- */
const RailFooter = ({
  onProfile,
  onLogout,
  name,
}: {
  onProfile: () => void;
  onLogout: () => void;
  name?: string;
}) => {
  const { open } = useSidebar();
  return (
    <div className="mt-auto border-t border-white/[0.06] pt-3">
      <button
        onClick={onProfile}
        className="flex w-full items-center gap-3 rounded-lg px-1.5 py-2 text-zinc-300 transition-colors hover:bg-white/5"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/80 to-teal-600/80 text-xs font-semibold text-white">
          {name?.charAt(0)?.toUpperCase() ?? <User className="h-4 w-4" />}
        </div>
        <span
          className="overflow-hidden whitespace-nowrap text-sm font-medium"
          style={{ opacity: open ? 1 : 0, width: open ? "auto" : 0 }}
        >
          {name ?? "Profile"}
        </span>
      </button>
      <NotificationsBell
        label={
          <span
            className="overflow-hidden whitespace-nowrap text-sm font-medium"
            style={{ opacity: open ? 1 : 0, width: open ? "auto" : 0 }}
          >
            Notifications
          </span>
        }
      />
      <ThemeToggle
        className="mt-1 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
        label={
          <span
            className="overflow-hidden whitespace-nowrap text-sm font-medium"
            style={{ opacity: open ? 1 : 0, width: open ? "auto" : 0 }}
          >
            Theme
          </span>
        }
      />
      <button
        onClick={onLogout}
        className="mt-1 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
      >
        <LogOut className="h-5 w-5 shrink-0" />
        <span
          className="overflow-hidden whitespace-nowrap text-sm font-medium"
          style={{ opacity: open ? 1 : 0, width: open ? "auto" : 0 }}
        >
          Log out
        </span>
      </button>
    </div>
  );
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();
  const user = useAppSelector((s) => s.user.user);

  // Live updates for chat, presence and notifications, everywhere in the app.
  useRealtime();
  const { data: conversations = [] } = useConversations();
  const chatUnread = conversations.reduce((n, c) => n + c.unreadCount, 0);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  // Chat conversation view + chat pages own the full viewport (no padding),
  // and the mobile dock hides inside an open conversation so it never covers
  // the message composer.
  const isChat = location.pathname.startsWith("/chat");
  const inConversation = /^\/chat\/.+/.test(location.pathname);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => navigate("/login", { replace: true }),
    });
  };

  const dockItems: DockItem[] = navItems.map((item) => ({
    title: item.label,
    icon: <item.icon className="h-full w-full p-1" />,
    active: isActive(item.path),
    onClick: () => navigate(item.path),
  }));

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      {/* ---- Desktop expandable rail ---- */}
      <SidebarProvider>
        <SidebarBody className="sticky top-0 h-screen">
          <RailBrand />
          <RailSearch />
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <SidebarLink
                key={item.path}
                link={{
                  label: item.label,
                  icon: <item.icon className="h-5 w-5" />,
                  active: isActive(item.path),
                  onClick: () => navigate(item.path),
                  badge: item.path === "/chat" ? chatUnread : undefined,
                }}
              />
            ))}
          </nav>
          <RailFooter
            name={user?.fullName}
            onProfile={() => navigate("/profile")}
            onLogout={handleLogout}
          />
        </SidebarBody>
      </SidebarProvider>

      {/* ---- Content ---- */}
      <main
        className={
          isChat
            ? "flex min-h-screen min-w-0 flex-1 flex-col"
            : "flex-1 min-w-0 p-4 pb-28 md:p-8 md:pb-8"
        }
      >
        {/* Mobile: workspace switcher (the desktop rail has its own) */}
        {!isChat && (
          <div className="mb-4 flex items-center justify-between md:hidden">
            <div className="max-w-[70%]">
              <WorkspaceSwitcher />
            </div>
            <NotificationsBell align="right" />
          </div>
        )}
        <Outlet />
      </main>

      {/* ---- Mobile floating dock (hidden on md+, and inside a conversation) ---- */}
      {!inConversation && (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 md:hidden">
          <FloatingDock items={dockItems} />
        </div>
      )}

      {/* ---- ⌘K command palette (global) ---- */}
      <CommandPalette />
    </div>
  );
}
