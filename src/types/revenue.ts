export interface RevenueData {
  id?: string;
  date: string;
  austin: number;
  charlotte: number;
}

export interface LocationMetric {
  revenue: number;
  target: number;
  percentage: number;
}

export interface LocationMetrics {
  austin: LocationMetric;
  charlotte: LocationMetric;
  combined: LocationMetric;
}

export type WeeklyMetrics = LocationMetrics;
export type MonthlyMetrics = LocationMetrics;

export interface DailyTarget {
  austin: number;
  charlotte: number;
}

export interface MonthlyTargetAdjustment {
  month: number; // 0-11 (January-December)
  year: number;
  workingDays: number[]; // Array of working days (1-31)
  austin?: number; // Optional override for Austin's daily target this month
  charlotte?: number; // Optional override for Charlotte's daily target this month
}

export interface TargetSettings {
  dailyTargets: DailyTarget;
  monthlyAdjustments: MonthlyTargetAdjustment[];
}

export type Location = "Austin" | "Charlotte" | "Combined";
export type TimeFrame = "MTD" | "last30" | "last90" | "YTD" | "all" | "custom";

export interface FilterOptions {
  startDate: string | null;
  endDate: string | null;
  location: Location;
  timeFrame: TimeFrame;
  attainmentThreshold: {
    min: number;
    max: number;
  };
}

export interface AppState {
  revenueData: RevenueData[];
  filterOptions: FilterOptions;
  targets?: DailyTarget;
  targetSettings?: TargetSettings;
}
