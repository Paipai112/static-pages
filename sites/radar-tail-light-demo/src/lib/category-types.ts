// 抽屉字段配置类型。放在独立文件避免 config ↔ 组件循环依赖.
export interface DrawerField {
  /** products.json 里 attributes 对象的键 */
  key: string;
  /** 抽屉里显示的中文标签 */
  label: string;
  /** 是否占据整行（长文本字段用） */
  wide?: boolean;
}

/** 价格段定义：按价格上限划分；最后一档可省略 max 表示上不封顶 */
export interface PriceTier {
  key: string;
  label: string;
  max?: number;
}

export interface CategoryConfigContract {
  category: string;
  eyebrow: string;
  siteTitle: string;
  siteLede: string;
  snapshotDate: string;
  marketplace: string;
  currencySymbol: string;
  dataNote: string;
  keyMetric: {
    label: string;
    unit?: string;
  };
  /** 卡片上附加的关键规格 chips（与 keyMetric 同排展示）；值取自 attributes */
  cardMetrics?: ReadonlyArray<{
    key: string;
    label: string;
    unit?: string;
  }>;
  /** 价格段（入门/中端/旗舰…），用于背景底色分区与段内销量排名 */
  priceTiers?: readonly PriceTier[];
  drawerFields: readonly DrawerField[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateCategoryConfig(
  config: CategoryConfigContract,
): string[] {
  const errors: string[] = [];
  const candidate = config as unknown as Record<string, unknown>;
  const requiredFields = [
    "category",
    "eyebrow",
    "siteTitle",
    "siteLede",
    "snapshotDate",
    "marketplace",
    "currencySymbol",
    "dataNote",
  ];

  for (const field of requiredFields) {
    if (!nonEmptyString(candidate[field])) {
      errors.push(`${field} 必须是非空字符串`);
    }
  }

  const keyMetric = candidate.keyMetric;
  if (!isRecord(keyMetric) || !nonEmptyString(keyMetric.label)) {
    errors.push("keyMetric.label 必须是非空字符串");
  }

  const drawerFields = candidate.drawerFields;
  if (!Array.isArray(drawerFields) || drawerFields.length === 0) {
    errors.push("drawerFields 必须是非空数组");
    return errors;
  }

  const keys = new Set<string>();
  for (const [index, field] of drawerFields.entries()) {
    if (!isRecord(field)) {
      errors.push(`drawerFields[${index}] 必须是对象`);
      continue;
    }

    const key = field.key;
    const label = field.label;
    if (!nonEmptyString(key)) {
      errors.push("drawerFields.key 必须是非空字符串");
      continue;
    }
    if (!nonEmptyString(label)) errors.push(`drawerFields.${key} 缺少 label`);
    if (keys.has(key)) errors.push(`drawerFields.${key} 重复`);
    keys.add(key);
  }

  return errors;
}

export function validateProductAttributes(
  attributes: Record<string, string | null>,
  drawerFields: readonly DrawerField[],
): string[] {
  if (!isRecord(attributes)) return ["attributes 必须是对象"];

  return drawerFields
    .filter(({ key }) => !Object.prototype.hasOwnProperty.call(attributes, key))
    .map(({ key }) => `attributes.${key} 缺失（缺失字段必须显式为 null）`);
}
