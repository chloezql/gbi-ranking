import Link from "next/link";

const METRICS = [
  {
    name: "Monthly Visits",
    weight: 40,
    description:
      "Total website traffic in the most recent month, normalized on a logarithmic scale. Log-scaling ensures that mid-sized brands are not completely overshadowed by giants like Amazon or Shein.",
  },
  {
    name: "3-Month Growth",
    weight: 25,
    description:
      "Traffic trajectory over the past three months, calculated as (Month 3 − Month 1) / Month 1. This captures momentum — a fast-growing brand scores higher than a stagnant one with more traffic.",
  },
  {
    name: "Pages per Visit",
    weight: 15,
    description:
      "Average number of pages viewed per session. Higher values indicate deeper user engagement and stronger content or product discovery.",
  },
  {
    name: "Bounce Rate (inverted)",
    weight: 10,
    description:
      "Percentage of visitors who leave after viewing only one page. We invert this metric so that a lower bounce rate yields a higher score — rewarding sites that retain visitors.",
  },
  {
    name: "Time on Site",
    weight: 10,
    description:
      "Average session duration in seconds. Longer sessions suggest more meaningful engagement with the brand's content or products.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <nav className="text-sm text-muted mb-8">
        <Link href="/" className="hover:text-accent transition-colors">
          Rankings
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Methodology</span>
      </nav>

      <h1 className="text-3xl font-bold tracking-tight mb-2">
        How We Score
      </h1>
      <p className="text-muted text-sm mb-10 leading-relaxed">
        The GBI Score is a composite rating from 20 to 95 that evaluates a brand's global online
        presence across five dimensions. All traffic data is sourced from{" "}
        <a
          href="https://www.similarweb.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground transition-colors"
        >
          SimilarWeb
        </a>
        .
      </p>

      {/* Metric breakdown */}
      <div className="flex flex-col gap-4 mb-12">
        {METRICS.map((m) => (
          <div
            key={m.name}
            className="bg-card border border-border rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">{m.name}</h3>
              <span className="text-sm font-bold text-accent">{m.weight}%</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 mb-3">
              <div
                className="bg-accent h-2 rounded-full"
                style={{ width: `${m.weight}%` }}
              />
            </div>
            <p className="text-xs text-muted leading-relaxed">{m.description}</p>
          </div>
        ))}
      </div>

      {/* Process */}
      <h2 className="text-lg font-bold mb-4">Scoring Process</h2>
      <div className="bg-card border border-border rounded-xl p-5 mb-12">
        <ol className="flex flex-col gap-3 text-sm text-muted">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
            <span><strong className="text-foreground">Normalize</strong> — Each metric is min-max normalized across the entire dataset. Visits use a log₁₀ scale to handle the wide range.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
            <span><strong className="text-foreground">Weight</strong> — Normalized values are multiplied by their respective weights and summed into a raw composite score.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
            <span><strong className="text-foreground">Rescale</strong> — The raw score is linearly rescaled so the top brand maps to ~95 and the bottom to ~20, making scores intuitive and comparable.</span>
          </li>
        </ol>
      </div>

      {/* FAQ */}
      <h2 className="text-lg font-bold mb-4">FAQ</h2>
      <div className="flex flex-col gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-1">Why not rank by visits alone?</h3>
          <p className="text-xs text-muted leading-relaxed">
            Raw traffic favors incumbents. A brand with 10M visits but declining traffic, high bounce rate, and low engagement may be less impressive than a fast-growing brand with 500K visits and deep user engagement. Our composite approach captures the full picture.
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-1">How often is data updated?</h3>
          <p className="text-xs text-muted leading-relaxed">
            Traffic data is refreshed monthly from SimilarWeb. Scores are recalculated each time new data is available.
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-1">Are scores absolute or relative?</h3>
          <p className="text-xs text-muted leading-relaxed">
            Relative. Scores are normalized within the current dataset, so they reflect how a brand compares to others in the index, not an absolute benchmark.
          </p>
        </div>
      </div>

      <div className="mt-12 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
        >
          ← Back to Rankings
        </Link>
      </div>
    </div>
  );
}
