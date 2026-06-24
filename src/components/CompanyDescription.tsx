"use client";

import { useLanguage, pickDescription } from "@/context/LanguageContext";

export function CompanyDescription({
  description,
  descriptionCn,
  className,
  fallback,
}: {
  description: string;
  descriptionCn: string;
  className?: string;
  fallback?: string;
}) {
  const { lang } = useLanguage();
  const text = pickDescription(lang, description, descriptionCn) || fallback || "";
  return <p className={className}>{text}</p>;
}
