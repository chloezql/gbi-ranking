import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="https://gbiworld.org" target="_blank" rel="noopener noreferrer" className="flex items-center">
          <Logo />
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
