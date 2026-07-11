import React, { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DockItem {
  title: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
  active?: boolean;
}

/**
 * macOS-style magnifying dock (Aceternity port).
 * Desktop: hover-magnify row. Mobile: floating button that expands a vertical stack.
 */
export const FloatingDock = ({
  items,
  desktopClassName,
  mobileClassName,
}: {
  items: DockItem[];
  desktopClassName?: string;
  mobileClassName?: string;
}) => {
  return (
    <>
      <FloatingDockDesktop items={items} className={desktopClassName} />
      <FloatingDockMobile items={items} className={mobileClassName} />
    </>
  );
};

const FloatingDockMobile = ({
  items,
  className,
}: {
  items: DockItem[];
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("relative block md:hidden", className)}>
      <AnimatePresence>
        {open && (
          <motion.div
            layoutId="dock-nav"
            className="absolute inset-x-0 bottom-full mb-2 flex flex-col items-center gap-2"
          >
            {items.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  y: 10,
                  transition: { delay: idx * 0.03 },
                }}
                transition={{ delay: (items.length - 1 - idx) * 0.03 }}
              >
                <DockButton
                  item={item}
                  onActivate={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-zinc-900/90 backdrop-blur",
                    item.active && "border-emerald-500/50 text-emerald-400",
                  )}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-zinc-900/90 text-zinc-200 backdrop-blur glow-emerald"
        aria-label="Open navigation"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
    </div>
  );
};

const FloatingDockDesktop = ({
  items,
  className,
}: {
  items: DockItem[];
  className?: string;
}) => {
  const mouseX = useMotionValue(Infinity);
  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        "mx-auto hidden h-16 items-end gap-3 rounded-2xl border border-white/10 bg-zinc-900/70 px-4 pb-3 backdrop-blur-xl md:flex",
        className,
      )}
    >
      {items.map((item) => (
        <IconContainer mouseX={mouseX} key={item.title} item={item} />
      ))}
    </motion.div>
  );
};

function IconContainer({
  mouseX,
  item,
}: {
  mouseX: ReturnType<typeof useMotionValue<number>>;
  item: DockItem;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? {
      x: 0,
      width: 0,
    };
    return val - bounds.x - bounds.width / 2;
  });

  const widthTransform = useTransform(distance, [-150, 0, 150], [40, 72, 40]);
  const heightTransform = useTransform(distance, [-150, 0, 150], [40, 72, 40]);
  const iconSize = useTransform(distance, [-150, 0, 150], [20, 36, 20]);

  const width = useSpring(widthTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });
  const height = useSpring(heightTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });
  const iconSizeSpring = useSpring(iconSize, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  return (
    <DockButton
      item={item}
      onActivate={() => item.onClick?.()}
      motionRef={ref}
      onHoverChange={setHovered}
      style={{ width, height }}
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-full bg-zinc-800/80 text-zinc-300 transition-colors",
        item.active && "bg-emerald-500/15 text-emerald-400",
      )}
    >
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 2, x: "-50%" }}
            className="absolute -top-8 left-1/2 w-fit whitespace-nowrap rounded-md border border-white/10 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-200"
          >
            {item.title}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        style={{ width: iconSizeSpring, height: iconSizeSpring }}
        className="flex items-center justify-center"
      >
        {item.icon}
      </motion.div>
    </DockButton>
  );
}

/** Renders either an <a> (href) or <button>, sharing dock styling. */
function DockButton({
  item,
  onActivate,
  className,
  children,
  style,
  motionRef,
  onHoverChange,
}: {
  item: DockItem;
  onActivate: () => void;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties | any;
  motionRef?: React.Ref<HTMLDivElement>;
  onHoverChange?: (v: boolean) => void;
}) {
  const content = children ?? item.icon;
  return (
    <motion.div
      ref={motionRef}
      style={style}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      onClick={onActivate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onActivate();
      }}
      className={cn("cursor-pointer", className)}
      aria-label={item.title}
    >
      {content}
    </motion.div>
  );
}

export default FloatingDock;
