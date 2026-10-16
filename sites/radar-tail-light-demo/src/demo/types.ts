export type AnalysisView = 'products' | 'brands' | 'market';
export type Metric = 'units' | 'revenue';

export interface TrendPoint {
  month: string;
  units: number | null;
  revenue: number | null;
}

export interface TrendSeries {
  id: string;
  label: string;
  brand?: string;
  color: string;
  points: TrendPoint[];
  source: string;
  productCount?: number;
}

export interface CandidateFilters {
  query: string;
  minUnits: string;
  maxUnits: string;
  minRevenue: string;
  maxRevenue: string;
  sort: 'selected' | 'units' | 'revenue' | 'name';
}

export interface AnalysisState {
  view: AnalysisView;
  metric: Metric;
  startMonth: string;
  endMonth: string;
  productIds: string[];
  brandIds: string[];
  filters: { products: CandidateFilters; brands: CandidateFilters };
}

export interface RoadmapState {
  brands: string[];
  minPrice: string;
  maxPrice: string;
  onlyFocused: boolean;
  focusedIds: string[];
}

export interface DemoConfiguration {
  schema: 'pm-report-demo/v1';
  name: string;
  page: 'roadmap' | 'analysis';
  roadmap: RoadmapState;
  analysis: AnalysisState;
}
