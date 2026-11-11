import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { dayTile } from "@/lib/dates";

/** Mosaico do dia: "QUA / 11", com um visto quando o turno já está feito. */
export function DayTile({ at, done = false, size = "md" }: { at: number; done?: boolean; size?: "sm" | "md" }) {
  const { weekday, day } = dayTile(at);
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center border",
        size === "md" ? "h-[3.25rem] w-[3.25rem] rounded-2xl" : "h-11 w-11 rounded-[14px]",
        done ? "border-accent-line bg-accent-soft text-accent" : "border-white/10 bg-white/[0.03]",
      )}
      aria-hidden
    >
      {done && size === "md" ? (
        <CheckIcon size={24} strokeWidth={2.6} />
      ) : (
        <>
          <span
            className={cn("font-semibold tracking-[0.12em]", size === "md" ? "text-[0.625rem]" : "text-[0.5625rem]", !done && "text-muted")}
          >
            {weekday}
          </span>
          <span className={cn("display", size === "md" ? "text-[1.375rem]" : "text-lg")}>{day}</span>
        </>
      )}
    </div>
  );
}
