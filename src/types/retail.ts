export interface VarianceItem {
  name: string;
  type: 'store' | 'category' | 'total';
  netSales: number;
  plan: number;
  lastYear?: number;
  dollarVariance: number; // netSales - plan
  percentVariance: number; // ((netSales - plan) / plan) * 100
  lyPercentVariance?: number; // ((netSales - lastYear) / lastYear) * 100
  isBeyondThreshold: boolean; // |percentVariance| > 2.0%
  isSwingStore?: boolean; // |percentVariance| > 5.0%
}

export type Verdict = 'ahead' | 'on plan' | 'behind';

export interface ParsedSalesData {
  week: string; // e.g., "Week 38"
  weekNumber?: number;
  total: VarianceItem;
  stores: VarianceItem[];
  categories: VarianceItem[];
  storeNotes: string;
  hasPlan: boolean;
  hasWeek: boolean;
  missingError?: {
    type: 'MISSING_PLAN' | 'MISSING_WEEK';
    message: string;
  };
  largestVariances: VarianceItem[]; // 2 to 4 largest beyond +-2%, gains first
  swingsCancelledOut: boolean;
  storesMissingLY: string[];
}

export interface AnalysisResponse {
  success: boolean;
  parsedData?: ParsedSalesData;
  commentary?: string;
  wordCount?: number;
  paragraphCount?: number;
  error?: string;
  missingMessage?: string;
  engine?: string;
}
