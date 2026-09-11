import Link from "next/link";

const PROGRAM_PILLARS = [
  ["CES Floor Program", "Focused visits to the technologies, categories, and companies most relevant to global growth."],
  ["Market Intelligence", "Briefings on North American market signals, channels, and opportunities for Chinese brands."],
  ["Business Connections", "Curated conversations with operators, service providers, and potential partners."],
];

export default function Ces2027Page() {
  return (
    <div>
      <section className="relative min-h-[520px] overflow-hidden bg-[#111923] text-white flex items-end">
        <img src="/banner.webp" alt="GBI global brand infrastructure" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-[#111923]/75" />
        <div className="relative max-w-6xl mx-auto w-full px-4 pt-24 pb-16">
          <p className="text-sm font-semibold text-white/70 uppercase tracking-[0.16em]">North America Business Delegation</p>
          <h1 className="mt-4 text-4xl sm:text-6xl font-bold">CES 2027</h1>
          <p className="mt-5 max-w-2xl text-base sm:text-lg text-white/80 leading-relaxed">
            A GBI business delegation for brands and service providers building their next stage of global growth in North America.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="mailto:info@gbiworld.org?subject=CES%202027%20delegation" className="px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:brightness-110 transition-colors">Request information</a>
            <a href="#program" className="px-4 py-2.5 rounded-lg border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors">View program</a>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-14 sm:py-20" id="program">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-accent">Program Framework</p>
          <h2 className="mt-2 text-3xl font-bold">A practical view of the North American market</h2>
          <p className="mt-4 text-muted leading-relaxed">The final itinerary, dates, delegation capacity, and participation requirements will be announced with the official program release.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mt-10">
          {PROGRAM_PILLARS.map(([title, description], index) => (
            <article key={title} className="border-t-2 border-accent pt-5">
              <p className="text-xs font-semibold text-muted">0{index + 1}</p>
              <h3 className="mt-3 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-12 grid lg:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <p className="text-sm font-semibold text-accent">Participation</p>
            <h2 className="mt-2 text-2xl font-bold">Register interest for the CES 2027 delegation</h2>
            <p className="mt-3 text-sm text-muted leading-relaxed max-w-2xl">Share your organization and international business priorities with the GBI team. We will send the confirmed program details when registration opens.</p>
          </div>
          <a href="mailto:info@gbiworld.org?subject=CES%202027%20delegation%20interest" className="px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold text-center hover:brightness-110 transition-colors">Register interest</a>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12">
        <Link href="/" className="text-sm font-medium text-accent hover:underline">Back to GBI Index</Link>
      </section>
    </div>
  );
}
