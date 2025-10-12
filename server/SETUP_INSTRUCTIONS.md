# Backend Server Setup Instructions

## Prerequisites

✅ npm packages are already installed in the server directory

## Step 1: Create the .env file

You need to create a `.env` file in the `server` directory with your Snowflake credentials.

Create a new file called `.env` in the `server` folder with the following content:

```env
# Snowflake Configuration
SNOWFLAKE_ACCOUNT=your_account.region
SNOWFLAKE_USERNAME=your_username
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_DATABASE=DBGA_TEST_ANALYTICS
SNOWFLAKE_SCHEMA=DBGA_TEST_EXTERNAL_MARKETING
SNOWFLAKE_WAREHOUSE=your_warehouse

# Server Configuration
PORT=3001
```

Replace the following values with your actual Snowflake credentials:

- `your_account.region` - Your Snowflake account identifier (e.g., "abc12345.us-east-1")
- `your_username` - Your Snowflake username
- `your_password` - Your Snowflake password
- `your_warehouse` - Your Snowflake warehouse name

## Step 2: Run the server

From the `server` directory, run:

```bash
npm start
```

You should see:

```
Successfully connected to Snowflake.
Server running on port 3001
```

## Step 3: Verify the connection

Once the server is running, the frontend application should automatically connect to it. You'll see in the browser console that it's no longer getting connection refused errors.

## Troubleshooting

1. **Connection refused errors**: Make sure the backend server is running on port 3001
2. **Snowflake connection errors**: Verify your credentials in the .env file
3. **"Unable to connect" message**: Check that your Snowflake account, warehouse, and credentials are correct

## Security Notes

- Never commit the .env file to version control
- Keep your Snowflake credentials secure
- Consider using environment-specific credentials for production
