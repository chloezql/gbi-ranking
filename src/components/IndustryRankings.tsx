"use client";

import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

type Brand = {
  rank: number;
  nameEn: string;
  nameZh: string;
  subEn: string;
  subZh: string;
  logo: string;
};

type Industry = {
  id: string;
  titleEn: string;
  titleZh: string;
  brands: Brand[];
};

const INDUSTRIES: Industry[] = [
  {
    id: "consumer_electronics",
    titleEn: "Smart Consumer Tech",
    titleZh: "智能消费电子",
    brands: [
      { rank: 1, nameEn: "DJI", nameZh: "大疆创新", subEn: "Smart Devices", subZh: "智能设备", logo: "/featured-logos/consumer_electronics-1.png" },
      { rank: 2, nameEn: "Xiaomi", nameZh: "小米", subEn: "Smartphones", subZh: "手机", logo: "/featured-logos/consumer_electronics-2.png" },
      { rank: 3, nameEn: "vivo", nameZh: "vivo", subEn: "Smartphones", subZh: "手机", logo: "/featured-logos/consumer_electronics-3.png" },
      { rank: 4, nameEn: "OPPO", nameZh: "OPPO", subEn: "Smartphones", subZh: "手机", logo: "/featured-logos/consumer_electronics-4.png" },
      { rank: 5, nameEn: "Lenovo", nameZh: "联想", subEn: "Computers & Tablets", subZh: "电脑/平板电脑", logo: "/featured-logos/consumer_electronics-5.png" },
      { rank: 6, nameEn: "HONOR", nameZh: "荣耀", subEn: "Smartphones", subZh: "手机", logo: "/featured-logos/consumer_electronics-6.png" },
      { rank: 7, nameEn: "TECNO", nameZh: "TECNO", subEn: "Smartphones", subZh: "手机", logo: "/featured-logos/consumer_electronics-7.png" },
      { rank: 8, nameEn: "Insta360", nameZh: "影石", subEn: "Cameras & Imaging", subZh: "相机摄影", logo: "/featured-logos/consumer_electronics-8.png" },
      { rank: 9, nameEn: "Red Magic", nameZh: "红魔", subEn: "Smartphones", subZh: "手机", logo: "/featured-logos/consumer_electronics-9.png" },
      { rank: 10, nameEn: "realme", nameZh: "真我", subEn: "Smartphones", subZh: "手机", logo: "/featured-logos/consumer_electronics-10.png" },
    ],
  },
  {
    id: "car",
    titleEn: "Automotive & Mobility",
    titleZh: "汽车出行",
    brands: [
      { rank: 1, nameEn: "BYD", nameZh: "比亚迪", subEn: "Passenger Vehicles", subZh: "乘用车", logo: "/featured-logos/car-1.png" },
      { rank: 2, nameEn: "XPENG", nameZh: "小鹏", subEn: "Passenger Vehicles", subZh: "乘用车", logo: "/featured-logos/car-2.png" },
      { rank: 3, nameEn: "GWM", nameZh: "长城汽车", subEn: "Passenger Vehicles", subZh: "乘用车", logo: "/featured-logos/car-3.png" },
      { rank: 4, nameEn: "JETOUR", nameZh: "捷途", subEn: "Passenger Vehicles", subZh: "乘用车", logo: "/featured-logos/car-4.png" },
      { rank: 5, nameEn: "GEELY", nameZh: "吉利汽车", subEn: "Passenger Vehicles", subZh: "乘用车", logo: "/featured-logos/car-5.png" },
      { rank: 6, nameEn: "MG", nameZh: "名爵汽车", subEn: "Passenger Vehicles", subZh: "乘用车", logo: "/featured-logos/car-6.png" },
      { rank: 7, nameEn: "CHANGAN", nameZh: "长安汽车", subEn: "Passenger Vehicles", subZh: "乘用车", logo: "/featured-logos/car-7.png" },
      { rank: 8, nameEn: "GAC", nameZh: "广汽", subEn: "Passenger Vehicles", subZh: "乘用车", logo: "/featured-logos/car-8.png" },
      { rank: 9, nameEn: "CHERY", nameZh: "奇瑞汽车", subEn: "Passenger Vehicles", subZh: "乘用车", logo: "/featured-logos/car-9.png" },
      { rank: 10, nameEn: "OMODA", nameZh: "欧萌达", subEn: "Passenger Vehicles", subZh: "乘用车", logo: "/featured-logos/car-10.png" },
    ],
  },
  {
    id: "home_appliances",
    titleEn: "Home & Living",
    titleZh: "家电与智能家居",
    brands: [
      { rank: 1, nameEn: "Haier", nameZh: "海尔", subEn: "Major Appliances", subZh: "大家电", logo: "/featured-logos/home_appliances-1.png" },
      { rank: 2, nameEn: "TCL", nameZh: "TCL", subEn: "Major Appliances", subZh: "大家电", logo: "/featured-logos/home_appliances-2.png" },
      { rank: 3, nameEn: "Hisense", nameZh: "海信", subEn: "Major Appliances", subZh: "大家电", logo: "/featured-logos/home_appliances-3.png" },
      { rank: 4, nameEn: "Roborock", nameZh: "石头", subEn: "Cleaning Appliances", subZh: "清洁家电", logo: "/featured-logos/home_appliances-4.png" },
      { rank: 5, nameEn: "DREAME", nameZh: "追觅", subEn: "Cleaning Appliances", subZh: "清洁家电", logo: "/featured-logos/home_appliances-5.png" },
      { rank: 6, nameEn: "Midea", nameZh: "美的", subEn: "Major Appliances", subZh: "大家电", logo: "/featured-logos/home_appliances-6.png" },
      { rank: 7, nameEn: "ECOVACS", nameZh: "科沃斯", subEn: "Cleaning Appliances", subZh: "清洁家电", logo: "/featured-logos/home_appliances-7.png" },
      { rank: 8, nameEn: "GREE", nameZh: "格力", subEn: "Major Appliances", subZh: "大家电", logo: "/featured-logos/home_appliances-8.png" },
      { rank: 9, nameEn: "MAMMOTION", nameZh: "库犸动力", subEn: "Cleaning Appliances", subZh: "清洁家电", logo: "/featured-logos/home_appliances-9.png" },
      { rank: 10, nameEn: "eufy", nameZh: "eufy", subEn: "Cleaning Appliances", subZh: "清洁家电", logo: "/featured-logos/home_appliances-10.png" },
    ],
  },
  {
    id: "new_retail",
    titleEn: "Retail & E-Commerce",
    titleZh: "零售电商",
    brands: [
      { rank: 1, nameEn: "SHEGLAM", nameZh: "SHEGLAM", subEn: "Beauty & Personal Care", subZh: "美妆个护", logo: "/featured-logos/new_retail-1.png" },
      { rank: 2, nameEn: "SHEIN", nameZh: "SHEIN", subEn: "E-Commerce Platform", subZh: "电商平台", logo: "/featured-logos/new_retail-2.png" },
      { rank: 3, nameEn: "POP MART", nameZh: "泡泡玛特", subEn: "Designer Toys", subZh: "潮玩", logo: "/featured-logos/new_retail-3.png" },
      { rank: 4, nameEn: "Temu", nameZh: "Temu", subEn: "E-Commerce Platform", subZh: "电商平台", logo: "/featured-logos/new_retail-4.png" },
      { rank: 5, nameEn: "Miniso", nameZh: "名创优品", subEn: "Home & Living", subZh: "家居生活", logo: "/featured-logos/new_retail-5.png" },
      { rank: 6, nameEn: "BLOKEES", nameZh: "布鲁可", subEn: "Designer Toys", subZh: "潮玩", logo: "/featured-logos/new_retail-6.png" },
      { rank: 7, nameEn: "Flower Knows", nameZh: "花知晓", subEn: "Beauty & Personal Care", subZh: "美妆个护", logo: "/featured-logos/new_retail-7.png" },
      { rank: 8, nameEn: "YesStyle", nameZh: "YesStyle", subEn: "E-Commerce Platform", subZh: "电商平台", logo: "/featured-logos/new_retail-8.png" },
      { rank: 9, nameEn: "Luvme", nameZh: "Luvme", subEn: "Apparel & Bags", subZh: "服饰鞋包", logo: "/featured-logos/new_retail-9.png" },
      { rank: 10, nameEn: "CHAGEE", nameZh: "霸王茶姬", subEn: "Food & Beverage", subZh: "食品酒饮", logo: "/featured-logos/new_retail-10.png" },
    ],
  },
];

const RANK_COLOR: Record<number, string> = {
  1: "text-amber-500 dark:text-amber-400",
  2: "text-slate-400 dark:text-slate-300",
  3: "text-orange-500 dark:text-orange-400",
};

export function IndustryRankings() {
  const { lang } = useLanguage();
  const zh = lang === "zh";

  return (
    <section className="mb-12">
      <div className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {zh ? "出海品牌行业榜" : "Brand Rankings by Industry"}
        </h2>
        <p className="text-muted mt-2 text-base leading-relaxed">
          {zh
            ? "智能消费电子、汽车出行、家电与智能家居、零售电商四大行业出海品牌社媒影响力 Top 10。"
            : "Top 10 overseas brands by social influence across Smart Consumer Tech, Automotive & Mobility, Home & Living and Retail & E-Commerce."}
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {INDUSTRIES.map((ind) => (
          <div
            key={ind.id}
            className="bg-card border border-border rounded-xl overflow-hidden flex flex-col"
          >
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border bg-accent-light/60">
              <h3 className="text-[13px] sm:text-sm font-bold text-accent truncate">
                {zh ? ind.titleZh : ind.titleEn}
              </h3>
            </div>
            <ul className="flex flex-col">
              {ind.brands.map((b) => (
                <li
                  key={b.rank}
                  className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-2 sm:py-2.5 border-b border-border/60 last:border-0 hover:bg-accent-light/40 transition-colors"
                >
                  <span
                    className={cn(
                      "w-4 sm:w-5 shrink-0 text-center text-sm font-bold tabular-nums",
                      RANK_COLOR[b.rank] ?? "text-muted font-mono font-medium"
                    )}
                  >
                    {b.rank}
                  </span>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-border flex items-center justify-center shrink-0 p-1">
                    <img
                      src={b.logo}
                      alt={b.nameEn}
                      loading="lazy"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] sm:text-sm font-semibold truncate">
                      {zh ? b.nameZh : b.nameEn}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-muted truncate">
                      {zh ? b.subZh : b.subEn}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
