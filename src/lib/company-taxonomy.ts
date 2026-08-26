export type CompanyType = "brand" | "service_provider";

export const COMPANY_TYPES: { value: CompanyType; label: string; description: string }[] = [
  { value: "brand", label: "Brand", description: "A company that sells products or services under its own brand." },
  { value: "service_provider", label: "Service Provider", description: "A company that supports brands with specialist products or services." },
];

export const COMPANY_CATEGORIES = [
  { slug: "retail_ecommerce", name: "Retail & E-commerce" },
  { slug: "consumer_electronics", name: "Consumer Electronics" },
  { slug: "beauty_personal_care", name: "Beauty & Personal Care" },
  { slug: "fashion_apparel", name: "Fashion & Apparel" },
  { slug: "automotive", name: "Automotive" },
  { slug: "home_living", name: "Home & Living" },
  { slug: "health_wellness", name: "Health & Wellness" },
  { slug: "food_beverage", name: "Food & Beverage" },
  { slug: "sports_outdoors", name: "Sports & Outdoors" },
  { slug: "travel_hospitality", name: "Travel & Hospitality" },
  { slug: "entertainment_media", name: "Entertainment & Media" },
  { slug: "software_business_services", name: "Software & Business Services" },
  { slug: "marketing_creative_services", name: "Marketing & Creative Services" },
  { slug: "logistics_supply_chain", name: "Logistics & Supply Chain" },
  { slug: "payments_fintech", name: "Payments & Fintech" },
  { slug: "other", name: "Other" },
] as const;

export type CompanyCategorySlug = (typeof COMPANY_CATEGORIES)[number]["slug"];

export function categoryName(slug: string | null | undefined): string {
  return COMPANY_CATEGORIES.find((category) => category.slug === slug)?.name ?? "Other";
}
