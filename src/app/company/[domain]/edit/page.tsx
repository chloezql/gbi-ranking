import { notFound } from "next/navigation";
import Link from "next/link";
import { getCompanyByDomain } from "@/lib/data";
import { CompanyProfileEditor } from "@/components/CompanyProfileEditor";

export default async function EditCompanyPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const company = await getCompanyByDomain(decodeURIComponent(domain));
  if (!company) notFound();

  return (
    <>
      <nav className="max-w-3xl mx-auto px-4 pt-8 text-sm text-muted">
        <Link href={`/company/${encodeURIComponent(company.domain)}`} className="hover:text-accent transition-colors">{company.domain}</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Edit profile</span>
      </nav>
      <CompanyProfileEditor
        profile={{
          domain: company.domain,
          title: company.title,
          description: company.description,
          logoUrl: company.logoUrl,
          originCountry: company.originCountry,
          companyType: company.companyType,
          primaryCategory: company.categorySlug,
          categorySlugs: company.categorySlugs,
        }}
      />
    </>
  );
}
