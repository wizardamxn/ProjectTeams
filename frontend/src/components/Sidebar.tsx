import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { FileText, MessageSquare, Users, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: FileText, label: "Documents", path: "/documents" },
  { icon: MessageSquare, label: "Chat", path: "/chat" },
  { icon: Users, label: "Team", path: "/team" },
];

export const Sidebar = () => {
  const location = useLocation();

  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-card p-4 h-[calc(100vh-140px)] min-w-[240px]"
    >
      <div className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link key={item.path} to={item.path}>
              <motion.div
                whileHover={{ x: 4 }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive
                    ? "bg-primary/20 text-primary-foreground"
                    : "hover:bg-white/5"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.aside>
  );
};
