const MISSING_TEXT_VALUES = new Set(["", "NA", "N/A"]);

export function displayOptionalText(value: string | null | undefined): string {
  const normalized = value?.trim() ?? "";
  return MISSING_TEXT_VALUES.has(normalized.toUpperCase())
    ? "暂无数据"
    : normalized;
}
