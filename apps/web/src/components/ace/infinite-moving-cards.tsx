import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface MovingCard {
  quote: string;
  name: string;
  title: string;
}

/**
 * Infinite marquee of cards (Aceternity port).
 * Duplicates children and scrolls via the `--animate-scroll` keyframe.
 */
export const InfiniteMovingCards = ({
  items,
  direction = "left",
  speed = "slow",
  pauseOnHover = true,
  className,
}: {
  items: MovingCard[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
  pauseOnHover?: boolean;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [start, setStart] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !scrollerRef.current) return;
    const scrollerContent = Array.from(scrollerRef.current.children);
    scrollerContent.forEach((item) => {
      const duplicate = item.cloneNode(true);
      scrollerRef.current?.appendChild(duplicate);
    });

    containerRef.current.style.setProperty(
      "--animation-direction",
      direction === "left" ? "forwards" : "reverse",
    );
    const duration =
      speed === "fast" ? "20s" : speed === "normal" ? "40s" : "80s";
    containerRef.current.style.setProperty("--scroll-duration", duration);
    setStart(true);
  }, [direction, speed]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "scroller relative z-20 max-w-7xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_15%,white_85%,transparent)]",
        className,
      )}
    >
      <ul
        ref={scrollerRef}
        className={cn(
          "flex w-max min-w-full shrink-0 flex-nowrap gap-4 py-4",
          start && "animate-scroll [animation-direction:var(--animation-direction)]",
          pauseOnHover && "hover:[animation-play-state:paused]",
        )}
      >
        {items.map((item, idx) => (
          <li
            key={idx}
            className="relative w-[320px] max-w-full shrink-0 rounded-2xl border border-white/[0.08] bg-zinc-900/60 px-6 py-5 md:w-[420px]"
          >
            <blockquote>
              <span className="relative z-20 text-sm font-normal leading-relaxed text-zinc-300">
                “{item.quote}”
              </span>
              <div className="relative z-20 mt-4 flex flex-col">
                <span className="text-sm font-semibold text-zinc-100">
                  {item.name}
                </span>
                <span className="text-xs text-zinc-500">{item.title}</span>
              </div>
            </blockquote>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default InfiniteMovingCards;
