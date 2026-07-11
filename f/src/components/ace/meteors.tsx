import { cn } from "@/lib/utils";

/**
 * Falling meteor streaks (Aceternity port).
 * Drop inside a `relative overflow-hidden` parent.
 */
export const Meteors = ({
  number = 20,
  className,
}: {
  number?: number;
  className?: string;
}) => {
  const meteors = new Array(number).fill(true);
  return (
    <>
      {meteors.map((_, idx) => {
        const left = Math.floor(Math.random() * 100);
        const delay = (Math.random() * 5).toFixed(2);
        const duration = Math.floor(Math.random() * 5 + 4);
        return (
          <span
            key={"meteor" + idx}
            className={cn(
              "animate-meteor pointer-events-none absolute top-1/2 left-1/2 h-0.5 w-0.5 rotate-[215deg] rounded-full bg-emerald-400 shadow-[0_0_0_1px_#ffffff10]",
              "before:absolute before:top-1/2 before:h-px before:w-[50px] before:-translate-y-1/2 before:bg-gradient-to-r before:from-emerald-400 before:to-transparent before:content-['']",
              className,
            )}
            style={{
              left: left + "%",
              animationDelay: delay + "s",
              animationDuration: duration + "s",
            }}
          />
        );
      })}
    </>
  );
};

export default Meteors;
