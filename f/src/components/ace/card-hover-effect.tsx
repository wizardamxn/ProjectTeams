import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Grid where a soft highlight follows the hovered cell (Aceternity port).
 * Generic: render arbitrary children per item via the `renderItem` prop.
 */
export function HoverEffect<T>({
  items,
  renderItem,
  onItemClick,
  className,
  itemClassName,
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  onItemClick?: (item: T, index: number) => void;
  className?: string;
  itemClassName?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {items.map((item, idx) => (
        <div
          key={idx}
          className="group relative block h-full w-full p-2"
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
          onClick={() => onItemClick?.(item, idx)}
        >
          <AnimatePresence>
            {hoveredIndex === idx && (
              <motion.span
                className="absolute inset-0 block h-full w-full rounded-2xl bg-emerald-500/10"
                layoutId="hoverBackground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.2 } }}
              />
            )}
          </AnimatePresence>
          <div
            className={cn(
              "relative z-10 h-full overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900/40 transition-colors duration-300 group-hover:border-emerald-500/30",
              itemClassName,
            )}
          >
            {renderItem(item, idx)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default HoverEffect;
