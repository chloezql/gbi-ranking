"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  title: string | null;
  link_url: string | null;
  is_committee_member: boolean | null;
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("user_profiles")
      .select("display_name, avatar_url, bio, title, link_url, is_committee_member")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setProfile(data));
  }, [user]);

  if (loading || !user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-10">
      <ProfileSection user={user} profile={profile} onSave={setProfile} />

      <section>
        <h2 className="text-lg font-semibold mb-4">My Company</h2>
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-muted text-sm">No companies yet.</p>
        </div>
      </section>
    </div>
  );
}

function InlineField({
  value,
  onSave,
  placeholder,
  inputType = "text",
  displayClassName = "text-sm text-foreground",
  emptyLabel,
}: {
  value: string;
  onSave: (val: string) => Promise<boolean>;
  placeholder: string;
  inputType?: string;
  displayClassName?: string;
  emptyLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(input);
    if (ok) setEditing(false);
    setSaving(false);
  };

  const PencilIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type={inputType}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
          placeholder={placeholder}
          className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button
          onClick={() => setEditing(false)}
          className="w-7 h-7 rounded-lg border border-border text-muted flex items-center justify-center hover:text-foreground hover:bg-border/40 transition-colors shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`truncate ${displayClassName}`}>
        {value || (emptyLabel ? <span className="text-muted italic">{emptyLabel}</span> : <span className="text-muted italic">{placeholder}</span>)}
      </span>
      <button
        onClick={() => { setInput(value); setEditing(true); }}
        className="text-muted hover:text-foreground transition-colors shrink-0"
        title={`Edit ${placeholder.toLowerCase()}`}
      >
        <PencilIcon />
      </button>
    </div>
  );
}

function ProfileSection({
  user,
  profile,
  onSave,
}: {
  user: User;
  profile: UserProfile | null;
  onSave: (updated: UserProfile) => void;
}) {
  const isCommittee = !!profile?.is_committee_member;

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [title, setTitle] = useState(profile?.title ?? "");
  const [linkUrl, setLinkUrl] = useState(profile?.link_url ?? "");

  const [editingBio, setEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bioInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setBio(profile?.bio ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
    setTitle(profile?.title ?? "");
    setLinkUrl(profile?.link_url ?? "");
  }, [profile]);

  useEffect(() => {
    if (editingBio) bioInputRef.current?.focus();
  }, [editingBio]);

  const upsert = async (patch: Partial<UserProfile>) => {
    const row = {
      id: user.id,
      display_name: displayName || null,
      avatar_url: avatarUrl || null,
      bio: bio || null,
      title: title || null,
      link_url: linkUrl || null,
      updated_at: new Date().toISOString(),
      ...patch,
    };
    const { error } = await supabase.from("user_profiles").upsert(row);
    if (!error) {
      onSave({
        display_name: row.display_name,
        avatar_url: row.avatar_url,
        bio: row.bio,
        title: row.title,
        link_url: row.link_url,
        is_committee_member: profile?.is_committee_member ?? null,
      });
    }
    return !error;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const newUrl = `${data.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(newUrl);
      await upsert({ avatar_url: newUrl });
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleSaveBio = async () => {
    setSavingBio(true);
    const ok = await upsert({ bio: bioInput || null });
    if (ok) { setBio(bioInput); setEditingBio(false); }
    setSavingBio(false);
  };

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Profile</h2>

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start gap-6">

          {/* Avatar */}
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover border border-accent"
              />
            ) : (
              <div className="w-20 h-20 rounded-full border border-accent bg-card text-accent flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload photo"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
            >
              {uploading ? (
                <span className="text-[9px] font-bold">…</span>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Fields */}
          <div className="flex-1 min-w-0 flex flex-col gap-3 pt-1">

            {/* Display name */}
            <InlineField
              value={displayName}
              placeholder="Your name"
              displayClassName="text-xl font-bold"
              onSave={async (val) => {
                const ok = await upsert({ display_name: val || null });
                if (ok) setDisplayName(val);
                return ok;
              }}
            />

            {/* Email */}
            <p className="text-sm text-muted -mt-1">{user.email}</p>

            {/* Title (committee only) */}
            {isCommittee && (
              <InlineField
                value={title}
                placeholder="Title / affiliation"
                onSave={async (val) => {
                  const ok = await upsert({ title: val || null });
                  if (ok) setTitle(val);
                  return ok;
                }}
              />
            )}

            {/* URL (committee only) */}
            {isCommittee && (
              <InlineField
                value={linkUrl}
                placeholder="Profile URL"
                inputType="url"
                displayClassName="text-sm text-muted"
                onSave={async (val) => {
                  const ok = await upsert({ link_url: val || null });
                  if (ok) setLinkUrl(val);
                  return ok;
                }}
              />
            )}

            {/* Bio */}
            {editingBio ? (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={bioInputRef}
                  value={bioInput}
                  onChange={e => setBioInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Escape") setEditingBio(false); }}
                  placeholder="A short bio about yourself"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveBio}
                    disabled={savingBio}
                    className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setEditingBio(false)}
                    className="w-7 h-7 rounded-lg border border-border text-muted flex items-center justify-center hover:text-foreground hover:bg-border/40 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-end justify-between gap-4">
                <span className="text-sm text-foreground">{bio || <span className="text-muted italic">No bio yet.</span>}</span>
                <button
                  onClick={() => { setBioInput(bio); setEditingBio(true); }}
                  className="text-sm font-medium text-accent hover:underline shrink-0"
                >
                  Edit
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  );
}
