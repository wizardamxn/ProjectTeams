import React, { createContext, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider");
  return context;
};

/**
 * Icon-rail sidebar that expands to reveal labels on hover (Aceternity port).
 * Desktop only — pair with FloatingDock for mobile.
 */
export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;
  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const SidebarBody = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const { setOpen, animate, open } = useSidebar();
  return (
    <motion.div
      className={cn(
        "hidden h-full w-[64px] shrink-0 flex-col border-r border-white/[0.06] bg-zinc-950/80 px-3 py-5 backdrop-blur-xl md:flex",
        className,
      )}
      animate={{ width: animate ? (open ? 232 : 64) : 232 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
    </motion.div>
  );
};

export interface SidebarLinkData {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export const SidebarLink = ({
  link,
  className,
}: {
  link: SidebarLinkData;
  className?: string;
}) => {
  const { open, animate } = useSidebar();
  return (
    <button
      onClick={link.onClick}
      className={cn(
        "group/sidebar flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors",
        link.active
          ? "bg-emerald-500/10 text-emerald-400"
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
        className,
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {link.icon}
      </span>
      <AnimatePresence>
        <motion.span
          animate={{
            opacity: animate ? (open ? 1 : 0) : 1,
            width: animate ? (open ? "auto" : 0) : "auto",
          }}
          className="overflow-hidden whitespace-nowrap text-sm font-medium"
        >
          {link.label}
        </motion.span>
      </AnimatePresence>
      {link.active && open && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
      )}
    </button>
  );
};

export default SidebarProvider;
