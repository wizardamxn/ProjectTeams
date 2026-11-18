import { Tip } from "@/components/ui/tooltip";
import { usePresence } from "@/api/chat";
import type { Person } from "@/api/types";

const SIZES = { xs: "h-5 w-5 text-[10px]", sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm" } as const;
const DOT = { xs: "h-2 w-2", sm: "h-2.5 w-2.5", md: "h-3 w-3" } as const;

/** Photo or initial, with a green dot when `showPresence` and they're online. */
export function Avatar({
  person,
  size = "md",
  showPresence = false,
}: {
  person: Person;
  size?: keyof typeof SIZES;
  showPresence?: boolean;
}) {
  const online = usePresence();
  const isOnline = online.has(person._id);
  return (
    <span className="relative inline-flex shrink-0">
      {person.avatarUrl ? (
        <img src={person.avatarUrl} alt="" referrerPolicy="no-referrer" className={`${SIZES[size]} rounded-full object-cover`} />
      ) : (
        <span className={`${SIZES[size]} flex items-center justify-center rounded-full bg-zinc-800 font-semibold text-zinc-300`}>
          {person.fullName.charAt(0).toUpperCase()}
        </span>
      )}
      {showPresence && (
        <Tip label={isOnline ? "Online" : "Offline"}><span
          className={`absolute -bottom-0.5 -right-0.5 ${DOT[size]} rounded-full ring-2 ring-zinc-950 ${
            isOnline ? "bg-emerald-500" : "bg-zinc-600"
          }`}
        /></Tip>
      )}
    </span>
  );
}
