"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Footer() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <footer className="bg-[#111923] text-white/80 mt-20 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
          <div>
            <img src="/gbi-white.png" alt="GBI" className="h-8 w-auto mb-4" />
            <p className="text-sm text-white/60 max-w-md leading-relaxed">
              GBI · Global Brand Infrastructure ranks and showcases the leading
              brands and service providers driving global expansion across
              markets and categories.
            </p>
            <p className="text-sm text-white/60 mt-4">
              <a
                href="mailto:info@gbiworld.org"
                className="hover:text-white transition-colors"
              >
                info@gbiworld.org
              </a>
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/90 mb-4">
              Partners
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-12 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-xs text-white/40"
                >
                  Partner {i}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/90">
              Disclaimer
            </h3>
            <button
              type="button"
              onClick={() => setShowDisclaimer((v) => !v)}
              className="sm:hidden inline-flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors"
              aria-expanded={showDisclaimer}
            >
              {showDisclaimer ? "Show less" : "Show more"}
              <svg
                className={cn(
                  "w-3 h-3 transition-transform",
                  showDisclaimer && "rotate-180"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
          <p
            className={cn(
              "text-xs text-white/50 leading-relaxed",
              showDisclaimer ? "block" : "hidden sm:block"
            )}
          >
            All data in the GBI Index is sourced directly from publicly
            available information on overseas media platforms. Due to the
            statistical rules and reporting lag of these platforms, the
            integrated data may contain minor discrepancies, and we cannot
            guarantee complete accuracy or completeness. The data we publish is
            provided for reference only and does not constitute investment
            advice. Any judgments, inferences, or opinions made by users based
            on this data do not represent our position; users expressly agree
            to bear all risks and consequences arising from their use of the
            data. Under no circumstances shall we be liable for any losses
            incurred from investment decisions made on the basis of our data.
            For any questions regarding the data, please contact us at{" "}
            <a
              href="mailto:info@gbiworld.org"
              className="text-white/70 hover:text-white underline"
            >
              info@gbiworld.org
            </a>
            .
          </p>
          <p className="text-xs text-white/40 mt-6">
            © {new Date().getFullYear()} GBI · All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
