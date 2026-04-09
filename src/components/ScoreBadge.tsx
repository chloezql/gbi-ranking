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
        "flex flex-col items-center justify-center w-14 h-14 rounded-xl text-center shrink-0",
        color
      )}
    >
      <span className="text-lg font-bold leading-none">{score}</span>
      <span className="text-[10px] opacity-70 mt-0.5">pts</span>
    </div>
  );
}
