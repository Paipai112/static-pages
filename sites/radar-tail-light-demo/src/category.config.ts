import type { CategoryConfigContract } from "./lib/category-types";

export const categoryConfig = {
  category: "radar-tail-light",

  eyebrow: "AMAZON 全球站点 · 品牌 × 价格 定位图",
  siteTitle: "自行车雷达尾灯 · 全球市场路标",
  siteLede:
    "以品牌为横轴、归一化美元售价为纵轴，观察各品牌的雷达尾灯产品定位与价格带分布。",
  snapshotDate: "2026-08-31", // 数据快照日期 = 取数当天

  marketplace: "全部站点（美国·德国·法国·意大利·西班牙·英国·加拿大·墨西哥·日本）",
  currencySymbol: "$",

  dataNote:
    "月销量与月销售额为卖家精灵基于 Amazon 商品快照的估算值，并非 Amazon 官方实销数据，月销口径为各在售站合计的最近 6 个完整月月均；展示价格按‘美站 > 加拿大站 > 全部在售站均价(参考汇率折合美元)’的优先级折算；雷达探测距离优先取商品标题/卖点，商品页未标注时取厂商官方规格并在详情注明来源；带摄像头的雷达尾灯已纳入，支架/保护壳/车载电脑/纯雷达(无尾灯)、套装等未收录。",

  // 卡片关键字段：雷达探测距离
  keyMetric: {
    label: "雷达探测距离",
    unit: "m",
  },

  // 卡片附加关键规格（与 keyMetric 一起展示）
  cardMetrics: [
    { key: "lumens", label: "流明", unit: "lm" },
    { key: "battery", label: "续航", unit: "" },
  ],

  // 价格段：入门 / 中端 / 旗舰（按 USD 归一化售价划分；边界改这里即可）
  priceTiers: [
    { key: "entry", label: "入门", max: 60 },
    { key: "mid", label: "中端", max: 120 },
    { key: "flagship", label: "旗舰" },
  ],

  drawerFields: [
    { key: "lumens", label: "流明" },
    { key: "battery", label: "续航" },
    { key: "camera", label: "形态" },
    { key: "marketsSold", label: "在售站点", wide: true },
  ],
} satisfies CategoryConfigContract;

export type CategoryConfig = typeof categoryConfig;
