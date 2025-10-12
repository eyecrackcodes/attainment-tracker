// Example Node.js/Express backend for Snowflake
const fs = require("fs");
const path = require("path");

// Try to load .env.local first, then fall back to .env
if (fs.existsSync(path.join(__dirname, ".env.local"))) {
  console.log("Loading environment from .env.local");
  require("dotenv").config({ path: ".env.local" });
} else {
  console.log("Loading environment from .env");
  require("dotenv").config();
}

// Verify environment variables are loaded
console.log("Environment check:");
console.log(
  "- SNOWFLAKE_ACCOUNT:",
  process.env.SNOWFLAKE_ACCOUNT ? "✓ Set" : "✗ Missing"
);
console.log(
  "- SNOWFLAKE_USERNAME:",
  process.env.SNOWFLAKE_USERNAME ? "✓ Set" : "✗ Missing"
);
console.log(
  "- SNOWFLAKE_PASSWORD:",
  process.env.SNOWFLAKE_PASSWORD ? "✓ Set" : "✗ Missing"
);
console.log(
  "- SNOWFLAKE_DATABASE:",
  process.env.SNOWFLAKE_DATABASE || "Not set"
);
console.log("- SNOWFLAKE_SCHEMA:", process.env.SNOWFLAKE_SCHEMA || "Not set");
console.log(
  "- SNOWFLAKE_WAREHOUSE:",
  process.env.SNOWFLAKE_WAREHOUSE ? "✓ Set" : "✗ Missing"
);

const express = require("express");
const snowflake = require("snowflake-sdk");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Snowflake connection configuration
const connection = snowflake.createConnection({
  account: process.env.SNOWFLAKE_ACCOUNT,
  username: process.env.SNOWFLAKE_USERNAME,
  password: process.env.SNOWFLAKE_PASSWORD,
  database: process.env.SNOWFLAKE_DATABASE,
  schema: process.env.SNOWFLAKE_SCHEMA,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
});

// Track connection status
let isConnected = false;

// Connect to Snowflake
connection.connect((err, conn) => {
  if (err) {
    console.error("Unable to connect: " + err.message);
    isConnected = false;
  } else {
    console.log("Successfully connected to Snowflake.");
    isConnected = true;
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: isConnected ? "healthy" : "unhealthy",
    connected: isConnected,
    timestamp: new Date().toISOString(),
  });
});

// Simple test endpoint to check data availability
app.get("/api/test-data", async (req, res) => {
  const query = `
    SELECT 
      COUNT(*) as total_records,
      MIN(CALL_TIMESTAMP_LOCAL) as earliest_date_utc,
      MAX(CALL_TIMESTAMP_LOCAL) as latest_date_utc,
      CONVERT_TIMEZONE('UTC', 'America/Chicago', MIN(CALL_TIMESTAMP_LOCAL)) as earliest_date_cst,
      CONVERT_TIMEZONE('UTC', 'America/Chicago', MAX(CALL_TIMESTAMP_LOCAL)) as latest_date_cst,
      COUNT(DISTINCT DEPARTMENT) as unique_departments,
      DATEDIFF('day', MAX(CALL_TIMESTAMP_LOCAL), CURRENT_TIMESTAMP()) as days_since_last_data
    FROM PL_DIC_CALL_SIM
  `;

  console.log(`[Test Data] Executing test query...`);

  connection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error(`[Test Data] Query error:`, err);
        res.status(500).json({ error: err.message });
      } else {
        console.log(`[Test Data] Query result:`, rows);
        res.json(rows);
      }
    },
  });
});

// Get unique departments
app.get("/api/test-departments", async (req, res) => {
  const query = `
    SELECT DISTINCT DEPARTMENT, COUNT(*) as record_count
    FROM PL_DIC_CALL_SIM
    GROUP BY DEPARTMENT
    ORDER BY record_count DESC
  `;

  console.log(`[Test Departments] Executing query...`);

  connection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error(`[Test Departments] Query error:`, err);
        res.status(500).json({ error: err.message });
      } else {
        console.log(`[Test Departments] Departments found:`, rows);
        res.json(rows);
      }
    },
  });
});

// Get available date range
app.get("/api/available-dates", async (req, res) => {
  const query = `
    SELECT 
      MIN(DATE(CONVERT_TIMEZONE('UTC', 'America/Chicago', CALL_TIMESTAMP_LOCAL))) as earliest_date_cst,
      MAX(DATE(CONVERT_TIMEZONE('UTC', 'America/Chicago', CALL_TIMESTAMP_LOCAL))) as latest_date_cst,
      DATEDIFF('day', MAX(CALL_TIMESTAMP_LOCAL), CURRENT_TIMESTAMP()) as days_old
    FROM PL_DIC_CALL_SIM
    WHERE DEPARTMENT IN ('ATX', 'CLT')
      AND AGENT_TYPE != 'AI'
  `;
  
  console.log(`[Available Dates] Executing query...`);
  
  connection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error(`[Available Dates] Query error:`, err);
        res.status(500).json({ error: err.message });
      } else {
        console.log(`[Available Dates] Result:`, rows);
        res.json(rows[0] || {});
      }
    },
  });
});

// API endpoint for daily lead metrics
app.get("/api/daily-lead-metrics", async (req, res) => {
  const { startDate, endDate, department } = req.query;

  console.log(`[Daily Metrics] Request received:`, {
    startDate,
    endDate,
    department: department || "ALL",
  });

  // Temporarily showing all departments for debugging
  const deptFilter = department
    ? `AND DEPARTMENT = '${department}'`
    : "-- AND DEPARTMENT IN ('ATX', 'CLT')"; // Commented out for debugging

  const query = `
    WITH call_metrics AS (
      SELECT
        DATE(CONVERT_TIMEZONE('UTC', 'America/Chicago', CALL_TIMESTAMP_LOCAL)) as date,
        DEPARTMENT as site,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN LEAD_UID = 'UNKNOWN' THEN 1 END) as missed_calls,
        COUNT(CASE WHEN LEAD_UID != 'UNKNOWN' AND BILLABLE_FLAG = 'Y' THEN 1 END) as billable_leads,
        COUNT(CASE WHEN LEAD_UID != 'UNKNOWN' AND SALE_MADE_FLAG = 'Y' THEN 1 END) as sales,
        COALESCE(SUM(CASE WHEN LEAD_UID != 'UNKNOWN' AND SALE_MADE_FLAG = 'Y' THEN ANNUAL_PREMIUM END), 0) as revenue,
        AVG(CASE WHEN LEAD_UID != 'UNKNOWN' THEN CALL_DURATION END) as avg_call_duration,
        AVG(CASE WHEN LEAD_UID != 'UNKNOWN' THEN AGE_YEARS END) as avg_age,
        COUNT(CASE WHEN LEAD_UID != 'UNKNOWN' AND GENDER = 'Male' THEN 1 END) as male_count,
        COUNT(CASE WHEN LEAD_UID != 'UNKNOWN' AND GENDER = 'Female' THEN 1 END) as female_count,
        COUNT(CASE WHEN LEAD_UID != 'UNKNOWN' AND SMOKER_CLASSIFICATION IN ('Non-Smoker', 'Never used') THEN 1 END) as non_smoker_count,
        COUNT(CASE WHEN LEAD_UID != 'UNKNOWN' AND SMOKER_CLASSIFICATION NOT IN ('Non-Smoker', 'Never used') THEN 1 END) as smoker_count
      FROM PL_DIC_CALL_SIM
      WHERE 1=1
        -- Temporarily removing AI filter for debugging
        -- AGENT_TYPE != 'AI'
        -- TODO: Add brokerage filter when field is identified (e.g., AND LEAD_SOURCE NOT LIKE '%Broker%')
        ${deptFilter}
        AND DATE(CONVERT_TIMEZONE('UTC', 'America/Chicago', CALL_TIMESTAMP_LOCAL)) >= '${startDate}'
        AND DATE(CONVERT_TIMEZONE('UTC', 'America/Chicago', CALL_TIMESTAMP_LOCAL)) <= '${endDate}'
      GROUP BY DATE(CONVERT_TIMEZONE('UTC', 'America/Chicago', CALL_TIMESTAMP_LOCAL)), DEPARTMENT
    )
    SELECT * FROM call_metrics ORDER BY date DESC, site
  `;

  console.log(`[Daily Metrics] Executing query...`);

  connection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error(`[Daily Metrics] Query error:`, err);
        res.status(500).json({ error: err.message });
      } else {
        console.log(
          `[Daily Metrics] Query successful. Rows returned: ${rows.length}`
        );
        if (rows.length > 0) {
          console.log(`[Daily Metrics] First row:`, rows[0]);
        }
        res.json(rows);
      }
    },
  });
});

// API endpoint for lead source metrics
app.get("/api/lead-source-metrics", async (req, res) => {
  const { startDate, endDate } = req.query;

  const query = `
    SELECT 
      LEAD_SOURCE,
      DEPARTMENT,
      COUNT(*) as total_calls,
      COUNT(CASE WHEN BILLABLE_FLAG = 'Y' THEN 1 END) as billable_leads,
      COUNT(CASE WHEN SALE_MADE_FLAG = 'Y' THEN 1 END) as sales,
      AVG(AGE_YEARS) as avg_age,
      COUNT(CASE WHEN GENDER = 'Male' THEN 1 END) as male_count,
      COUNT(CASE WHEN GENDER = 'Female' THEN 1 END) as female_count,
      COUNT(CASE WHEN SMOKER_CLASSIFICATION IN ('Non-Smoker', 'Never used') THEN 1 END) as non_smoker_count,
      COUNT(CASE WHEN SMOKER_CLASSIFICATION NOT IN ('Non-Smoker', 'Never used') THEN 1 END) as smoker_count
    FROM PL_DIC_CALL_SIM
    WHERE AGENT_TYPE != 'AI'
      AND LEAD_UID != 'UNKNOWN'  -- Exclude missed calls
      -- TODO: Add brokerage filter when field is identified (e.g., AND LEAD_SOURCE NOT LIKE '%Broker%')
      AND DEPARTMENT IN ('ATX', 'CLT')
      AND CALL_TIMESTAMP_LOCAL >= '${startDate}'
      AND CALL_TIMESTAMP_LOCAL < '${endDate}'
    GROUP BY LEAD_SOURCE, DEPARTMENT
    ORDER BY billable_leads DESC
  `;

  connection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    },
  });
});

// API endpoint for agent comparison
app.get("/api/agent-comparison", async (req, res) => {
  const { startDate, endDate } = req.query;

  const query = `
    SELECT 
      DATE(CALL_TIMESTAMP_LOCAL) as date,
      CASE WHEN AGENT_TYPE = 'AI' THEN 'AI' ELSE 'Human' END as agent_type,
      COUNT(*) as total_calls,
      COUNT(CASE WHEN BILLABLE_FLAG = 'Y' THEN 1 END) as billable_leads,
      COUNT(CASE WHEN SALE_MADE_FLAG = 'Y' THEN 1 END) as sales,
      AVG(CALL_DURATION) as avg_call_duration,
      COALESCE(SUM(CASE WHEN SALE_MADE_FLAG = 'Y' THEN ANNUAL_PREMIUM END), 0) as revenue
    FROM PL_DIC_CALL_SIM
    WHERE LEAD_UID != 'UNKNOWN'  -- Exclude missed calls
      -- TODO: Add brokerage filter when field is identified (e.g., AND LEAD_SOURCE NOT LIKE '%Broker%')
      AND CALL_TIMESTAMP_LOCAL >= '${startDate}'
      AND CALL_TIMESTAMP_LOCAL < '${endDate}'
    GROUP BY DATE(CALL_TIMESTAMP_LOCAL), CASE WHEN AGENT_TYPE = 'AI' THEN 'AI' ELSE 'Human' END
    ORDER BY date DESC, agent_type
  `;

  connection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    },
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
