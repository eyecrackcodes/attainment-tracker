import { DailyLeadMetrics } from "../types/snowflake";
import { LeadEntryStored } from "../services/leadService";
import { RevenueData } from "../types/revenue";

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    snowflakeRecords: number;
    firebaseRecords: number;
    matchedRecords: number;
    discrepancies: number;
  };
}

// Validate data consistency between Snowflake and Firebase
export const validateDataConsistency = (
  snowflakeData: DailyLeadMetrics[],
  firebaseData: Map<string, Record<"ATX" | "CLT", LeadEntryStored | null>>
): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    stats: {
      snowflakeRecords: snowflakeData.length,
      firebaseRecords: firebaseData.size,
      matchedRecords: 0,
      discrepancies: 0,
    },
  };

  // Check each Snowflake record against Firebase
  snowflakeData.forEach((snowflakeRecord) => {
    const firebaseEntry = firebaseData.get(snowflakeRecord.date);

    if (!firebaseEntry) {
      result.warnings.push(`No Firebase data for ${snowflakeRecord.date}`);
      return;
    }

    const firebaseSiteData = firebaseEntry[snowflakeRecord.site];

    if (!firebaseSiteData) {
      result.warnings.push(
        `No Firebase data for ${snowflakeRecord.site} on ${snowflakeRecord.date}`
      );
      return;
    }

    // Compare key metrics
    const tolerance = 0.05; // 5% tolerance for floating point comparisons

    if (
      Math.abs(
        snowflakeRecord.billableLeads - firebaseSiteData.totalBillableLeads
      ) > 1
    ) {
      result.errors.push(
        `Lead count mismatch on ${snowflakeRecord.date} ${snowflakeRecord.site}: ` +
          `Snowflake=${snowflakeRecord.billableLeads}, Firebase=${firebaseSiteData.totalBillableLeads}`
      );
      result.discrepancies++;
    } else {
      result.stats.matchedRecords++;
    }

    // Validate conversion rates if sales data exists
    if (firebaseSiteData.sales !== undefined && snowflakeRecord.sales > 0) {
      const snowflakeConversion = snowflakeRecord.conversionRate;
      const firebaseConversion = firebaseSiteData.derived.conversionRate || 0;

      if (Math.abs(snowflakeConversion - firebaseConversion) > tolerance) {
        result.warnings.push(
          `Conversion rate mismatch on ${snowflakeRecord.date} ${snowflakeRecord.site}: ` +
            `Snowflake=${snowflakeConversion.toFixed(
              2
            )}%, Firebase=${firebaseConversion.toFixed(2)}%`
        );
      }
    }
  });

  result.isValid = result.errors.length === 0;
  return result;
};

// Validate Snowflake data integrity
export const validateSnowflakeData = (
  data: DailyLeadMetrics[]
): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    stats: {
      snowflakeRecords: data.length,
      firebaseRecords: 0,
      matchedRecords: 0,
      discrepancies: 0,
    },
  };

  data.forEach((record) => {
    // Check for required fields
    if (!record.date || !record.site) {
      result.errors.push(
        `Missing required fields in record: ${JSON.stringify(record)}`
      );
      result.isValid = false;
      return;
    }

    // Validate data ranges
    if (record.billableLeads < 0 || record.totalCalls < 0 || record.sales < 0) {
      result.errors.push(
        `Negative values in record for ${record.date} ${record.site}`
      );
      result.isValid = false;
    }

    // Logical validations
    if (record.billableLeads > record.totalCalls) {
      result.errors.push(
        `Billable leads (${record.billableLeads}) exceed total calls (${record.totalCalls}) ` +
          `on ${record.date} ${record.site}`
      );
      result.isValid = false;
    }

    if (record.sales > record.billableLeads) {
      result.errors.push(
        `Sales (${record.sales}) exceed billable leads (${record.billableLeads}) ` +
          `on ${record.date} ${record.site}`
      );
      result.isValid = false;
    }

    // Validate conversion rate calculation
    const expectedConversionRate =
      record.billableLeads > 0
        ? (record.sales / record.billableLeads) * 100
        : 0;

    if (Math.abs(record.conversionRate - expectedConversionRate) > 0.01) {
      result.warnings.push(
        `Conversion rate calculation mismatch on ${record.date} ${record.site}: ` +
          `Stored=${record.conversionRate.toFixed(
            2
          )}%, Calculated=${expectedConversionRate.toFixed(2)}%`
      );
    }

    // Check for reasonable values
    if (record.avgCallDuration > 3600) {
      // More than 1 hour average
      result.warnings.push(
        `Unusually high average call duration (${record.avgCallDuration}s) on ${record.date} ${record.site}`
      );
    }

    if (record.conversionRate > 50) {
      // More than 50% conversion
      result.warnings.push(
        `Unusually high conversion rate (${record.conversionRate.toFixed(
          2
        )}%) on ${record.date} ${record.site}`
      );
    }
  });

  return result;
};

// Test fallback behavior
export const testFallbackBehavior = async (
  primaryDataFetch: () => Promise<any>,
  fallbackDataFetch: () => Promise<any>
): Promise<{
  primarySuccess: boolean;
  fallbackSuccess: boolean;
  primaryTime: number;
  fallbackTime: number;
  error?: string;
}> => {
  const result = {
    primarySuccess: false,
    fallbackSuccess: false,
    primaryTime: 0,
    fallbackTime: 0,
    error: undefined as string | undefined,
  };

  // Test primary data source
  const primaryStart = Date.now();
  try {
    await primaryDataFetch();
    result.primarySuccess = true;
  } catch (error) {
    result.error = (error as Error).message;
  }
  result.primaryTime = Date.now() - primaryStart;

  // Test fallback data source
  const fallbackStart = Date.now();
  try {
    await fallbackDataFetch();
    result.fallbackSuccess = true;
  } catch (error) {
    if (!result.error) {
      result.error = (error as Error).message;
    }
  }
  result.fallbackTime = Date.now() - fallbackStart;

  return result;
};

// Validate revenue data transformation
export const validateRevenueTransformation = (
  snowflakeMetrics: DailyLeadMetrics[],
  revenueData: RevenueData[]
): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    stats: {
      snowflakeRecords: snowflakeMetrics.length,
      firebaseRecords: revenueData.length,
      matchedRecords: 0,
      discrepancies: 0,
    },
  };

  // Group Snowflake data by date
  const snowflakeByDate = new Map<
    string,
    { austin: number; charlotte: number }
  >();

  snowflakeMetrics.forEach((metric) => {
    const existing = snowflakeByDate.get(metric.date) || {
      austin: 0,
      charlotte: 0,
    };
    if (metric.site === "ATX") {
      existing.austin = metric.revenue;
    } else if (metric.site === "CLT") {
      existing.charlotte = metric.revenue;
    }
    snowflakeByDate.set(metric.date, existing);
  });

  // Validate each revenue record
  revenueData.forEach((revenue) => {
    const snowflakeData = snowflakeByDate.get(revenue.date);

    if (!snowflakeData) {
      result.warnings.push(
        `No Snowflake data for revenue date ${revenue.date}`
      );
      return;
    }

    const tolerance = 0.01; // $0.01 tolerance

    if (Math.abs(revenue.austin - snowflakeData.austin) > tolerance) {
      result.errors.push(
        `Austin revenue mismatch on ${revenue.date}: ` +
          `Revenue=${revenue.austin}, Snowflake=${snowflakeData.austin}`
      );
      result.discrepancies++;
    }

    if (Math.abs(revenue.charlotte - snowflakeData.charlotte) > tolerance) {
      result.errors.push(
        `Charlotte revenue mismatch on ${revenue.date}: ` +
          `Revenue=${revenue.charlotte}, Snowflake=${snowflakeData.charlotte}`
      );
      result.discrepancies++;
    }

    if (result.discrepancies === 0) {
      result.stats.matchedRecords++;
    }
  });

  result.isValid = result.errors.length === 0;
  return result;
};

// Create validation report
export const createValidationReport = (
  validations: ValidationResult[]
): string => {
  let report = "=== Data Validation Report ===\n\n";

  validations.forEach((validation, index) => {
    report += `Test ${index + 1}:\n`;
    report += `Status: ${validation.isValid ? "PASSED" : "FAILED"}\n`;
    report += `Stats: ${JSON.stringify(validation.stats, null, 2)}\n`;

    if (validation.errors.length > 0) {
      report += `\nErrors (${validation.errors.length}):\n`;
      validation.errors.forEach((error) => (report += `  - ${error}\n`));
    }

    if (validation.warnings.length > 0) {
      report += `\nWarnings (${validation.warnings.length}):\n`;
      validation.warnings.forEach((warning) => (report += `  - ${warning}\n`));
    }

    report += "\n---\n\n";
  });

  return report;
};
