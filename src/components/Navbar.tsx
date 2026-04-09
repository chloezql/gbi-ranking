import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center text-white text-sm font-black">
            G
          </span>
          <span className="tracking-tight">GBI Index</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
