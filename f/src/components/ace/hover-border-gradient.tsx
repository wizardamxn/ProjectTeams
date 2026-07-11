import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Direction = "TOP" | "LEFT" | "BOTTOM" | "RIGHT";

/**
 * Button/link with an animated gradient border that travels around the edge,
 * and lights up on hover (Aceternity port).
 */
export function HoverBorderGradient({
  children,
  containerClassName,
  className,
  as: Tag = "button",
  duration = 1,
  clockwise = true,
  ...props
}: React.PropsWithChildren<
  {
    as?: React.ElementType;
    containerClassName?: string;
    className?: string;
    duration?: number;
    clockwise?: boolean;
  } & Record<string, any>
>) {
  const [hovered, setHovered] = useState(false);
  const [direction, setDirection] = useState<Direction>("TOP");

  const rotateDirection = (current: Direction): Direction => {
    const directions: Direction[] = ["TOP", "LEFT", "BOTTOM", "RIGHT"];
    const currentIndex = directions.indexOf(current);
    const nextIndex = clockwise
      ? (currentIndex - 1 + directions.length) % directions.length
      : (currentIndex + 1) % directions.length;
    return directions[nextIndex];
  };

  const movingMap: Record<Direction, string> = {
    TOP: "radial-gradient(20.7% 50% at 50% 0%, hsl(160 84% 55%) 0%, rgba(255,255,255,0) 100%)",
    LEFT: "radial-gradient(16.6% 43.1% at 0% 50%, hsl(160 84% 55%) 0%, rgba(255,255,255,0) 100%)",
    BOTTOM:
      "radial-gradient(20.7% 50% at 50% 100%, hsl(160 84% 55%) 0%, rgba(255,255,255,0) 100%)",
    RIGHT:
      "radial-gradient(16.2% 41.2% at 100% 50%, hsl(160 84% 55%) 0%, rgba(255,255,255,0) 100%)",
  };

  const highlight =
    "radial-gradient(75% 181.15% at 50% 50%, #14b8a6 0%, rgba(255,255,255,0) 100%)";

  useEffect(() => {
    if (!hovered) {
      const interval = setInterval(() => {
        setDirection((prev) => rotateDirection(prev));
      }, duration * 1000);
      return () => clearInterval(interval);
    }
  }, [hovered, duration]);

  return (
    <Tag
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative flex h-min w-fit content-center items-center justify-center overflow-visible rounded-full border border-white/10 bg-white/[0.03] p-px transition duration-500 hover:bg-white/5",
        containerClassName,
      )}
      {...props}
    >
      <div
        className={cn(
          "z-10 rounded-[inherit] bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white",
          className,
        )}
      >
        {children}
      </div>
      <motion.div
        className="absolute inset-0 z-0 flex-none overflow-hidden rounded-[inherit]"
        style={{ filter: "blur(2px)" }}
        initial={{ background: movingMap[direction] }}
        animate={{
          background: hovered
            ? [movingMap[direction], highlight]
            : movingMap[direction],
        }}
        transition={{ ease: "linear", duration: duration ?? 1 }}
      />
      <div className="absolute inset-[2px] z-[1] flex-none rounded-[inherit] bg-zinc-950" />
    </Tag>
  );
}

export default HoverBorderGradient;
