import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  FileText,
  LogOut,
  User,
  Menu,
  X,
  LayoutDashboard,
  MessageSquare,
  Users,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import axios from "axios";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: FileText, label: "Documents", path: "/documents" },
  { icon: MessageSquare, label: "Chat", path: "/chat" },
  { icon: Users, label: "Team", path: "/team" },
];

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const handleLogout = () => {
    const res = axios.post(
      "${backendURL}/logout",
      {},
      { withCredentials: true }
    );
    navigate("/login");
  };

  return (
    <>
      {/* --- Main Navbar --- */}
      <nav className="h-16 border-b border-zinc-800 bg-[#09090b]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Hamburger Button (Mobile Only) */}
            <button
              onClick={() => setIsOpen(true)}
              className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center group-hover:border-zinc-700 transition-colors">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-bold text-white tracking-tight">
                Project Teams
              </span>
            </Link>
          </div>

          {/* Desktop Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/profile")}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </button>
            <div className="h-4 w-[1px] bg-zinc-800 hidden md:block" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* --- Mobile Drawer (Overlay) --- */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* 1. Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] md:hidden"
            />

            {/* 2. Slide-out Panel */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-[#09090b] border-r border-zinc-800 z-[70] md:hidden flex flex-col shadow-2xl"
            >
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <span className="font-bold text-white">Menu</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-zinc-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
                          active
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-400 hover:text-zinc-100"
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-5 h-5",
                            active ? "text-emerald-500" : "text-zinc-500"
                          )}
                        />
                        <span className="font-medium text-sm">
                          {item.label}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-auto p-4 border-t border-zinc-800 bg-zinc-900/50">
                <button
                  onClick={() => {
                    navigate("/profile");
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-3 px-3 py-3 w-full text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium text-sm">Profile</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
