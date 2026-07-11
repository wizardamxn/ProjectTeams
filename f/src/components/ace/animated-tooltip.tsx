import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";

export interface TooltipItem {
  id: string | number;
  name: string;
  designation?: string;
  initials?: string;
  image?: string;
}

/**
 * Overlapping avatar stack with a springy tooltip on hover (Aceternity port).
 * Falls back to colored initials when no image is provided.
 */
export const AnimatedTooltip = ({
  items,
  className,
}: {
  items: TooltipItem[];
  className?: string;
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<string | number | null>(null);
  const springConfig = { stiffness: 100, damping: 5 };
  const x = useMotionValue(0);
  const rotate = useSpring(useTransform(x, [-100, 100], [-45, 45]), springConfig);
  const translateX = useSpring(
    useTransform(x, [-100, 100], [-50, 50]),
    springConfig,
  );

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const halfWidth = event.currentTarget.offsetWidth / 2;
    x.set(event.nativeEvent.offsetX - halfWidth);
  };

  return (
    <div className={cn("flex flex-row items-center", className)}>
      {items.map((item) => (
        <div
          className="group relative -mr-3"
          key={item.id}
          onMouseEnter={() => setHoveredIndex(item.id)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <AnimatePresence mode="popLayout">
            {hoveredIndex === item.id && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { type: "spring", stiffness: 260, damping: 10 },
                }}
                exit={{ opacity: 0, y: 20, scale: 0.6 }}
                style={{ translateX, rotate, whiteSpace: "nowrap" }}
                className="absolute -top-14 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 shadow-xl"
              >
                <div className="absolute inset-x-8 -bottom-px z-30 h-px w-1/2 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
                <div className="relative z-30 text-sm font-semibold text-white">
                  {item.name}
                </div>
                {item.designation && (
                  <div className="text-xs text-zinc-400">{item.designation}</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <div
            onMouseMove={handleMouseMove}
            className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-800 bg-gradient-to-br from-emerald-500/80 to-teal-600/80 text-sm font-semibold text-white transition duration-500 group-hover:z-30 group-hover:scale-105"
          >
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                className="h-full w-full object-cover"
              />
            ) : (
              (item.initials ?? item.name.charAt(0)).toUpperCase()
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AnimatedTooltip;
