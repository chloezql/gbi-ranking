"use client";

interface Props {
  domain: string;
  reason: "listed" | "pending";
  onClose: () => void;
}

export function DuplicateCompanyModal({ domain, reason, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4 bg-card border border-border rounded-2xl shadow-2xl p-8"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col items-center text-center gap-4 pt-2">
          <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>

          <div>
            <h2 className="text-lg font-bold mb-1">Company already exists</h2>
            <p className="text-muted text-sm">
              <span className="font-medium text-foreground">{domain}</span>{" "}
              {reason === "listed"
                ? "is already listed in our directory."
                : "already has a submission under review."}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
