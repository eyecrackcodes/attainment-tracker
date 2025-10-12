// Example Node.js/Express backend for Snowflake
require("dotenv").config();
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

// API endpoint for daily lead metrics
app.get("/api/daily-lead-metrics", async (req, res) => {
  const { startDate, endDate, department } = req.query;

  const deptFilter = department
    ? `AND DEPARTMENT = '${department}'`
    : "AND DEPARTMENT IN ('ATX', 'CLT')";

  const query = `
    SELECT 
      DATE(CALL_TIMESTAMP_LOCAL) as date,
      DEPARTMENT as site,
      COUNT(*) as total_calls,
      COUNT(CASE WHEN BILLABLE_FLAG = 'Y' THEN 1 END) as billable_leads,
      COUNT(CASE WHEN SALE_MADE_FLAG = 'Y' THEN 1 END) as sales,
      COALESCE(SUM(CASE WHEN SALE_MADE_FLAG = 'Y' THEN ANNUAL_PREMIUM END), 0) as revenue,
      AVG(CALL_DURATION) as avg_call_duration,
      AVG(AGE_YEARS) as avg_age,
      COUNT(CASE WHEN GENDER = 'Male' THEN 1 END) as male_count,
      COUNT(CASE WHEN GENDER = 'Female' THEN 1 END) as female_count,
      COUNT(CASE WHEN SMOKER_CLASSIFICATION IN ('Non-Smoker', 'Never used') THEN 1 END) as non_smoker_count,
      COUNT(CASE WHEN SMOKER_CLASSIFICATION NOT IN ('Non-Smoker', 'Never used') THEN 1 END) as smoker_count
    FROM PL_DIC_CALL_SIM
    WHERE AGENT_TYPE != 'AI'
      ${deptFilter}
      AND CALL_TIMESTAMP_LOCAL >= '${startDate}'
      AND CALL_TIMESTAMP_LOCAL < '${endDate}'
    GROUP BY DATE(CALL_TIMESTAMP_LOCAL), DEPARTMENT
    ORDER BY date DESC, site
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
    WHERE CALL_TIMESTAMP_LOCAL >= '${startDate}'
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
