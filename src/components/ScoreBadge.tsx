import { cn } from "@/lib/utils";

export function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75
      ? "bg-accent text-white"
      : score >= 50
        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center w-[84px] h-[84px] rounded-2xl text-center shrink-0 cursor-help shadow-sm transition-transform duration-200 hover:scale-[1.02]",
        color
      )}
    >
      <span className="text-[26px] font-bold leading-none">{score}</span>
      <span className="text-xs opacity-70 mt-1">pts</span>
    </div>
  );
}
