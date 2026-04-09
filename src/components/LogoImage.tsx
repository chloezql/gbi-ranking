"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export function LogoImage({
  src,
  alt,
  eager = false,
}: {
  src: string;
  alt: string;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const letter = alt.charAt(0).toUpperCase();

  const handleLoad = useCallback(() => setLoaded(true), []);

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <span
        className={`text-muted text-xs font-bold transition-opacity duration-200 ${loaded ? "opacity-0" : "opacity-100"}`}
      >
        {letter}
      </span>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={`absolute inset-0 m-auto max-w-[80%] max-h-[80%] object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={handleLoad}
        onError={() => setLoaded(false)}
      />
    </div>
  );
}
