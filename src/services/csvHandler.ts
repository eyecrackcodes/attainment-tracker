import Papa from "papaparse";
import { RevenueData, TargetSettings } from "../types/revenue";
import { calculateStakeholderInsights, calculateBusinessIntelligence } from "../utils/calculations";

interface CSVRow {
  Date: string;
  "Austin Revenue": string;
  "Charlotte Revenue": string;
}

export const importCSV = (file: File): Promise<RevenueData[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = (results.data as CSVRow[]).map((row) => ({
            date: row.Date,
            austin: parseFloat(row["Austin Revenue"]),
            charlotte: parseFloat(row["Charlotte Revenue"]),
          }));
          resolve(data);
        } catch (error) {
          reject(
            new Error("Error parsing CSV data. Please check the file format.")
          );
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};

export const exportCSV = (data: RevenueData[]): void => {
  const csvData = data.map((row) => ({
    Date: row.date,
    "Austin Revenue": row.austin,
    "Charlotte Revenue": row.charlotte,
  }));

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `revenue_data_${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Enhanced export with analytics insights
export const exportAnalyticsReport = (
  data: RevenueData[],
  targetSettings: TargetSettings
): void => {
  if (!data || data.length === 0) {
    alert("No data available for analytics export.");
    return;
  }

  const stakeholderInsights = calculateStakeholderInsights(data, targetSettings);
  const businessIntelligence = calculateBusinessIntelligence(data, targetSettings);

  // Create comprehensive analytics report
  const analyticsData = [
    // Executive Summary
    {
      Section: "Executive Summary",
      Metric: "Current Performance",
      Value: `${stakeholderInsights.executiveSummary.currentPerformance.toFixed(1)}%`,
      Description: "Monthly attainment percentage",
    },
    {
      Section: "Executive Summary",
      Metric: "Monthly Projection",
      Value: `${stakeholderInsights.executiveSummary.monthlyProjection.toFixed(1)}%`,
      Description: "Projected month-end attainment",
    },
    {
      Section: "Executive Summary",
      Metric: "Risk Level",
      Value: stakeholderInsights.executiveSummary.riskLevel.toUpperCase(),
      Description: "Current risk assessment",
    },
    {
      Section: "Executive Summary",
      Metric: "Key Insight",
      Value: stakeholderInsights.executiveSummary.keyInsight,
      Description: "Primary strategic insight",
    },

    // Performance Metrics
    {
      Section: "Performance Metrics",
      Metric: "Average Daily Revenue",
      Value: `$${businessIntelligence.performanceMetrics.averageDailyRevenue.toLocaleString()}`,
      Description: "Mean daily revenue across all locations",
    },
    {
      Section: "Performance Metrics",
      Metric: "Peak Day Revenue",
      Value: `$${businessIntelligence.performanceMetrics.peakDayRevenue.toLocaleString()}`,
      Description: "Highest single-day revenue",
    },
    {
      Section: "Performance Metrics",
      Metric: "Consistency Score",
      Value: `${businessIntelligence.performanceMetrics.consistencyScore.toFixed(1)}%`,
      Description: "Performance stability measurement",
    },
    {
      Section: "Performance Metrics",
      Metric: "Growth Rate",
      Value: `${businessIntelligence.performanceMetrics.growthRate.toFixed(1)}%`,
      Description: "Week-over-week growth trend",
    },

    // Location Analysis
    {
      Section: "Location Analysis",
      Metric: "Austin Contribution",
      Value: `${businessIntelligence.locationAnalysis.austin.contribution.toFixed(1)}%`,
      Description: "Austin's share of total revenue",
    },
    {
      Section: "Location Analysis",
      Metric: "Austin Efficiency",
      Value: `${businessIntelligence.locationAnalysis.austin.efficiency.toFixed(1)}%`,
      Description: "Austin's target achievement rate",
    },
    {
      Section: "Location Analysis",
      Metric: "Charlotte Contribution",
      Value: `${businessIntelligence.locationAnalysis.charlotte.contribution.toFixed(1)}%`,
      Description: "Charlotte's share of total revenue",
    },
    {
      Section: "Location Analysis",
      Metric: "Charlotte Efficiency",
      Value: `${businessIntelligence.locationAnalysis.charlotte.efficiency.toFixed(1)}%`,
      Description: "Charlotte's target achievement rate",
    },

    // Risk Analysis
    {
      Section: "Risk Analysis",
      Metric: "Revenue at Risk",
      Value: `$${stakeholderInsights.riskAnalysis.revenueAtRisk.toLocaleString()}`,
      Description: "Potential revenue shortfall",
    },
    {
      Section: "Risk Analysis",
      Metric: "Days to Recovery",
      Value: stakeholderInsights.riskAnalysis.daysToRecovery.toString(),
      Description: "Business days needed to recover shortfall",
    },

    // Forecasting
    {
      Section: "Forecasting",
      Metric: "Month-End Austin Projection",
      Value: `$${stakeholderInsights.performanceForecasting.monthEndProjection.austin.toLocaleString()}`,
      Description: "Projected Austin month-end revenue",
    },
    {
      Section: "Forecasting",
      Metric: "Month-End Charlotte Projection",
      Value: `$${stakeholderInsights.performanceForecasting.monthEndProjection.charlotte.toLocaleString()}`,
      Description: "Projected Charlotte month-end revenue",
    },
    {
      Section: "Forecasting",
      Metric: "Forecast Confidence",
      Value: `${stakeholderInsights.performanceForecasting.monthEndProjection.confidence.toFixed(0)}%`,
      Description: "Statistical confidence in projections",
    },
  ];

  // Add recommendations
  stakeholderInsights.strategicRecommendations.immediate.forEach((rec, index) => {
    analyticsData.push({
      Section: "Immediate Actions",
      Metric: `Action ${index + 1}`,
      Value: rec,
      Description: "Requires immediate attention",
    });
  });

  stakeholderInsights.strategicRecommendations.shortTerm.forEach((rec, index) => {
    analyticsData.push({
      Section: "Short-term Actions",
      Metric: `Action ${index + 1}`,
      Value: rec,
      Description: "Implement within this week",
    });
  });

  stakeholderInsights.strategicRecommendations.longTerm.forEach((rec, index) => {
    analyticsData.push({
      Section: "Long-term Actions",
      Metric: `Action ${index + 1}`,
      Value: rec,
      Description: "Strategic initiative for this month",
    });
  });

  const csv = Papa.unparse(analyticsData);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `analytics_report_${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const generateTemplate = (): void => {
  const template = [
    {
      Date: new Date().toLocaleDateString(),
      "Austin Revenue": "0",
      "Charlotte Revenue": "0",
    },
  ];

  const csv = Papa.unparse(template);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", "revenue_template.csv");
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
