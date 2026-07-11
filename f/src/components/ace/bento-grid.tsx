import React from "react";
import { cn } from "@/lib/utils";

/**
 * Bento grid layout (Aceternity port). Compose with <BentoGridItem/> children
 * and use `md:col-span-*` / `md:row-span-*` on items for varied cell sizes.
 */
export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-7xl grid-cols-1 gap-4 md:auto-rows-[19rem] md:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  icon,
}: {
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "group/bento row-span-1 flex flex-col justify-between space-y-4 overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900/40 p-5 shadow-input transition duration-200 hover:border-emerald-500/30",
        className,
      )}
    >
      {header}
      <div className="transition duration-200 group-hover/bento:translate-x-1">
        {icon}
        <div className="mt-2 mb-1 font-sans font-semibold text-zinc-100">
          {title}
        </div>
        <div className="font-sans text-sm text-zinc-400">{description}</div>
      </div>
    </div>
  );
};

export default BentoGrid;
