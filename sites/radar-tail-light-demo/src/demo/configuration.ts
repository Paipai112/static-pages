import catalog from '../data/products.json';
import type { AnalysisState, CandidateFilters, DemoConfiguration, RoadmapState } from './types';

const STORAGE_KEY = 'pm-report-demo/v1';
const productIds = new Set(catalog.map(product => product.productId));
const brands = new Set(catalog.map(product => product.brand));

type RecordValue = Record<string, unknown>;

function record(value: unknown, label: string, keys: readonly string[]): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}必须是对象。`);
  }
  const result = value as RecordValue;
  const extra = Object.keys(result).find(key => !keys.includes(key));
  if (extra) throw new Error(`${label}包含不支持的字段「${extra}」。`);
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(result, key)) {
      throw new Error(`${label}缺少字段「${key}」。`);
    }
  }
  return result;
}

function text(value: unknown, label: string, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${label}必须是文本。`);
  if (value.length > maximum) throw new Error(`${label}最多可填写 ${maximum} 个字符。`);
  return value;
}

function option<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${label}无效，可使用：${allowed.join('、')}。`);
  }
  return value as T;
}

function selection(value: unknown, allowed: Set<string>, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label}必须是数组。`);
  const maximum = Math.max(100, allowed.size * 4);
  if (value.length > maximum) throw new Error(`${label}条目过多，最多可导入 ${maximum} 条。`);
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.has(item)) {
      throw new Error(`${label}中存在无法识别的项目；请使用当前报告的产品 ID 或厂商名称。`);
    }
  }
  return [...new Set(value as string[])];
}

function numericText(value: unknown, label: string): string {
  const result = text(value, label, 32).trim();
  if (result === '') return '';
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(result) || !Number.isFinite(Number(result))) {
    throw new Error(`${label}请填写非负数字，或留空。`);
  }
  return String(Number(result));
}

function range(minimum: string, maximum: string, label: string): void {
  if (minimum !== '' && maximum !== '' && Number(minimum) > Number(maximum)) {
    throw new Error(`${label}下限不能大于上限。`);
  }
}

function month(value: unknown, label: string): string {
  const result = text(value, label, 7);
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(result) || result < '2025-09' || result > '2026-08') {
    throw new Error(`${label}应在 2025-09 至 2026-08 之间。`);
  }
  return result;
}

function candidateFilters(value: unknown, label: string): CandidateFilters {
  const source = record(value, label, ['query', 'minUnits', 'maxUnits', 'minRevenue', 'maxRevenue', 'sort']);
  const result: CandidateFilters = {
    query: text(source.query, `${label}搜索词`, 160),
    minUnits: numericText(source.minUnits, `${label}销量下限`),
    maxUnits: numericText(source.maxUnits, `${label}销量上限`),
    minRevenue: numericText(source.minRevenue, `${label}销额下限`),
    maxRevenue: numericText(source.maxRevenue, `${label}销额上限`),
    sort: option(source.sort, ['selected', 'units', 'revenue', 'name'], `${label}排序方式`),
  };
  range(result.minUnits, result.maxUnits, `${label}销量`);
  range(result.minRevenue, result.maxRevenue, `${label}销额`);
  return result;
}

function roadmapState(value: unknown): RoadmapState {
  const source = record(value, 'Roadmap 配置', ['brands', 'minPrice', 'maxPrice', 'onlyFocused', 'focusedIds']);
  if (typeof source.onlyFocused !== 'boolean') throw new Error('Roadmap 仅关注选项必须为布尔值。');
  const result: RoadmapState = {
    brands: selection(source.brands, brands, 'Roadmap 厂商'),
    minPrice: numericText(source.minPrice, '价格下限'),
    maxPrice: numericText(source.maxPrice, '价格上限'),
    onlyFocused: source.onlyFocused,
    focusedIds: selection(source.focusedIds, productIds, 'Roadmap 关注产品'),
  };
  range(result.minPrice, result.maxPrice, '价格');
  return result;
}

function analysisState(value: unknown): AnalysisState {
  const source = record(value, '竞品分析配置', ['view', 'metric', 'startMonth', 'endMonth', 'productIds', 'brandIds', 'filters']);
  const filters = record(source.filters, '竞品分析筛选条件', ['products', 'brands']);
  const result: AnalysisState = {
    view: option(source.view, ['products', 'brands', 'market'], '分析视图'),
    metric: option(source.metric, ['units', 'revenue'], '纵轴单位'),
    startMonth: month(source.startMonth, '开始月份'),
    endMonth: month(source.endMonth, '结束月份'),
    productIds: selection(source.productIds, productIds, '选中产品'),
    brandIds: selection(source.brandIds, brands, '选中厂商'),
    filters: {
      products: candidateFilters(filters.products, '产品筛选'),
      brands: candidateFilters(filters.brands, '厂商筛选'),
    },
  };
  if (result.startMonth > result.endMonth) throw new Error('开始月份不能晚于结束月份。');
  return result;
}

/** 全部字段通过后才返回独立的新配置，调用方可一次性替换页面状态。 */
export function parseConfiguration(input: unknown): DemoConfiguration {
  const source = record(input, '配置文件', ['schema', 'name', 'page', 'roadmap', 'analysis']);
  if (source.schema !== STORAGE_KEY) throw new Error('配置版本不支持，请选择当前 Demo 导出的配置文件。');
  const name = text(source.name, '配置名称', 80).trim();
  if (!name) throw new Error('请填写配置名称。');
  return {
    schema: STORAGE_KEY,
    name,
    page: option(source.page, ['roadmap', 'analysis'], '当前页面'),
    roadmap: roadmapState(source.roadmap),
    analysis: analysisState(source.analysis),
  };
}

export function downloadJson(filename: string, value: unknown): void {
  const serialized = JSON.stringify(value, null, 2);
  if (serialized === undefined) throw new Error('没有可下载的配置内容。');
  const blob = new Blob([serialized], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const safeName = filename.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 160) || 'report-configuration.json';
  anchor.download = safeName.endsWith('.json') ? safeName : `${safeName}.json`;
  anchor.hidden = true;
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function saveConfiguration(value: DemoConfiguration): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parseConfiguration(value)));
    return true;
  } catch {
    return false;
  }
}

export function loadConfiguration(): DemoConfiguration | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseConfiguration(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}
