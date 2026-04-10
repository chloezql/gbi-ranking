"use client";

export function Logo() {
  return (
    <>
      <img
        src="/gbi-dark.png"
        alt="GBI"
        className="h-7 block dark:hidden"
      />
      <img
        src="/gbi-white.png"
        alt="GBI"
        className="h-7 hidden dark:block"
      />
    </>
  );
}
