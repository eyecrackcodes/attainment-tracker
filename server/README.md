# Snowflake Backend API

This backend service is required because the Snowflake SDK cannot run directly in browser environments.

## Setup

1. **Install dependencies:**

   ```bash
   cd server
   npm init -y
   npm install express snowflake-sdk cors dotenv
   ```

2. **Create .env file:**

   ```env
   SNOWFLAKE_ACCOUNT=your_account.region
   SNOWFLAKE_USERNAME=your_username
   SNOWFLAKE_PASSWORD=your_password
   SNOWFLAKE_DATABASE=DBGA_TEST_ANALYTICS
   SNOWFLAKE_SCHEMA=DBGA_TEST_EXTERNAL_MARKETING
   SNOWFLAKE_WAREHOUSE=your_warehouse
   PORT=3001
   ```

3. **Run the server:**
   ```bash
   node snowflakeAPI.js
   ```

## API Endpoints

- `GET /api/health` - Check API health
- `GET /api/daily-lead-metrics` - Get daily lead metrics
  - Query params: `startDate`, `endDate`, `department` (optional)
- `GET /api/lead-source-metrics` - Get lead source performance
  - Query params: `startDate`, `endDate`
- `GET /api/agent-comparison` - Get AI vs Human performance
  - Query params: `startDate`, `endDate`

## Alternative Solutions

If you prefer not to run a separate backend:

1. **Use Snowflake's REST API directly** - Requires implementing OAuth2 authentication
2. **Use a serverless function** (Vercel, Netlify Functions, AWS Lambda)
3. **Use a proxy service** like Supabase or Hasura that can connect to Snowflake

## Security Notes

- Never expose Snowflake credentials in the frontend
- Implement proper authentication for your API endpoints
- Use environment variables for all sensitive data
- Consider implementing rate limiting and CORS policies
