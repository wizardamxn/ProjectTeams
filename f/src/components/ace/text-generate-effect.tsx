import { useEffect } from "react";
import { motion, stagger, useAnimate } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Word-by-word blur-in reveal (Aceternity port).
 * Renders `words` split on whitespace, each fading + un-blurring in sequence.
 */
export const TextGenerateEffect = ({
  words,
  className,
  filter = true,
  duration = 0.5,
}: {
  words: string;
  className?: string;
  filter?: boolean;
  duration?: number;
}) => {
  const [scope, animate] = useAnimate();
  const wordsArray = words.split(" ");

  useEffect(() => {
    animate(
      "span",
      {
        opacity: 1,
        filter: filter ? "blur(0px)" : "none",
      },
      {
        duration: duration,
        delay: stagger(0.12),
      },
    );
  }, [scope.current]);

  return (
    <div className={cn("font-semibold", className)}>
      <motion.div ref={scope}>
        {wordsArray.map((word, idx) => (
          <motion.span
            key={word + idx}
            className="opacity-0"
            style={{ filter: filter ? "blur(10px)" : "none" }}
          >
            {word}{" "}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
};

export default TextGenerateEffect;
