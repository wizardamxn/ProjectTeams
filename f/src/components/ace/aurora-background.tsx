import React from "react";
import { cn } from "@/lib/utils";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: React.ReactNode;
  showRadialGradient?: boolean;
}

/**
 * Aurora gradient backdrop (Aceternity port, Tailwind v4).
 * Emerald/teal aurora sweeping behind content.
 */
export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center bg-zinc-950 text-foreground transition-bg",
        className,
      )}
      {...props}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={cn(
            `pointer-events-none absolute -inset-[10px] opacity-40 blur-[10px] invert-0 will-change-transform`,
            `[--aurora:repeating-linear-gradient(100deg,#10b981_10%,#14b8a6_15%,#34d399_20%,#2dd4bf_25%,#6ee7b7_30%)]`,
            `[--dark-gradient:repeating-linear-gradient(100deg,#000_0%,#000_7%,transparent_10%,transparent_12%,#000_16%)]`,
            `[background-image:var(--dark-gradient),var(--aurora)]`,
            `[background-size:300%,_200%] [background-position:50%_50%,50%_50%]`,
            `after:absolute after:inset-0 after:[background-image:var(--dark-gradient),var(--aurora)]`,
            `after:[background-size:200%,_100%] after:[background-attachment:fixed] after:mix-blend-difference after:content-[""]`,
            `animate-aurora`,
            showRadialGradient &&
              `[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]`,
          )}
        />
      </div>
      {children}
    </div>
  );
};

export default AuroraBackground;
