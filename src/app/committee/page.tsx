import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface CommitteeMember {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  title: string | null;
  link_url: string | null;
}

function getLinkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function MemberCard({ member }: { member: CommitteeMember }) {
  const name = member.display_name ?? "Member";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col items-center text-center gap-4">
      {/* Avatar */}
      {member.avatar_url ? (
        <img
          src={member.avatar_url}
          alt={name}
          className="w-32 aspect-[3/4] object-cover rounded-xl"
        />
      ) : (
        <div className="w-32 aspect-[3/4] rounded-xl bg-accent/10 flex items-center justify-center text-accent text-2xl font-bold">
          {initials}
        </div>
      )}

      {/* Info */}
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-base text-foreground">{name}</p>
        {member.title && (
          <p className="text-sm text-muted">{member.title}</p>
        )}
      </div>

      {/* Link */}
      {member.link_url && (
        <a
          href={member.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
        >
          {getLinkLabel(member.link_url)}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}

export default async function CommitteePage() {
  const { data } = await supabase
    .from("user_profiles")
    .select("id, display_name, avatar_url, title, link_url")
    .eq("is_committee_member", true)
    .order("display_name");

  const members = (data ?? []) as CommitteeMember[];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted mb-8">
        <Link href="/" className="hover:text-accent transition-colors">
          Rankings
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Committee</span>
      </nav>

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-foreground">Committee Members</h1>
        <p className="text-muted text-sm mt-2">
          Meet the people behind the GBI Ranking methodology and evaluation process.
        </p>
      </div>

      {/* Grid */}
      {members.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
          <p className="text-muted text-sm">No committee members yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {members.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}
