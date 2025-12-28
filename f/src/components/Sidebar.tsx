import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, FileText, MessageSquare, Users, Database } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: FileText, label: "Documents", path: "/documents" },
  { icon: MessageSquare, label: "Chat", path: "/chat" },
  { icon: Users, label: "Team", path: "/team" },
];

export const Sidebar = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <aside className="hidden md:flex flex-col w-64 h-[calc(100vh-80px)] sticky top-20 border-r border-zinc-800 bg-[#09090b]">
      <div className="px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link key={item.path} to={item.path}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group",
                  active
                    ? "bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
                )}
              >
                <Icon className={cn("w-5 h-5", active ? "text-white" : "text-zinc-500 group-hover:text-zinc-300")} />
                <span className="font-medium text-sm">{item.label}</span>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Storage Widget (Desktop Only) */}
     
    </aside>
  );
};