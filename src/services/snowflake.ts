// import { createConnection } from 'snowflake-sdk';
import { RevenueData } from "../types/revenue";

/*
// Snowflake connection configuration
const snowflakeConfig = {
  account: process.env.VITE_SNOWFLAKE_ACCOUNT,
  username: process.env.VITE_SNOWFLAKE_USERNAME,
  password: process.env.VITE_SNOWFLAKE_PASSWORD,
  database: process.env.VITE_SNOWFLAKE_DATABASE,
  schema: process.env.VITE_SNOWFLAKE_SCHEMA,
  warehouse: process.env.VITE_SNOWFLAKE_WAREHOUSE,
};

// Initialize Snowflake connection
let connection: any = null;

const initializeConnection = async () => {
  try {
    connection = createConnection(snowflakeConfig);
    await new Promise((resolve, reject) => {
      connection.connect((err: any, conn: any) => {
        if (err) {
          console.error('Unable to connect to Snowflake:', err);
          reject(err);
        } else {
          console.log('Successfully connected to Snowflake!');
          resolve(conn);
        }
      });
    });
  } catch (error) {
    console.error('Error initializing Snowflake connection:', error);
    throw error;
  }
};
*/

export const snowflakeService = {
  /*
  // Initialize the connection
  initialize: async () => {
    if (!connection) {
      await initializeConnection();
    }
    return connection;
  },

  // Subscribe to real-time revenue updates
  subscribeToRevenueUpdates: (callback: (data: RevenueData[]) => void) => {
    // Implementation will depend on how your Snowflake data is structured
    // and how you want to handle real-time updates

    // Example polling mechanism (replace with your preferred method)
    const pollInterval = 5 * 60 * 1000; // 5 minutes
    const poll = async () => {
      try {
        const query = `
          SELECT 
            TO_VARCHAR(date, 'YYYY-MM-DD') as date,
            SUM(CASE WHEN location = 'Austin' THEN revenue ELSE 0 END) as austin,
            SUM(CASE WHEN location = 'Charlotte' THEN revenue ELSE 0 END) as charlotte
          FROM revenue_table
          WHERE date >= DATEADD(day, -90, CURRENT_DATE())
          GROUP BY date
          ORDER BY date DESC
        `;

        const result = await new Promise((resolve, reject) => {
          connection.execute({
            sqlText: query,
            complete: (err: any, stmt: any, rows: any) => {
              if (err) {
                reject(err);
              } else {
                resolve(rows);
              }
            }
          });
        });

        // Transform the data to match RevenueData structure
        const transformedData = result.map((row: any) => ({
          date: row.DATE,
          austin: parseFloat(row.AUSTIN),
          charlotte: parseFloat(row.CHARLOTTE)
        }));

        callback(transformedData);
      } catch (error) {
        console.error('Error polling Snowflake:', error);
      }
    };

    // Start polling
    const intervalId = setInterval(poll, pollInterval);
    poll(); // Initial poll

    // Return cleanup function
    return () => clearInterval(intervalId);
  },

  // Add a new revenue entry
  addRevenueEntry: async (entry: RevenueData) => {
    try {
      const query = `
        INSERT INTO revenue_table (date, location, revenue)
        VALUES
          (?, 'Austin', ?),
          (?, 'Charlotte', ?)
      `;

      await new Promise((resolve, reject) => {
        connection.execute({
          sqlText: query,
          binds: [entry.date, entry.austin, entry.date, entry.charlotte],
          complete: (err: any, stmt: any, rows: any) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows);
            }
          }
        });
      });

      return true;
    } catch (error) {
      console.error('Error adding revenue entry to Snowflake:', error);
      return false;
    }
  }
  */
};

// Example usage in your components:
/*
import { snowflakeService } from '../services/snowflake';

// In your component:
useEffect(() => {
  // Initialize Snowflake connection
  snowflakeService.initialize()
    .then(() => {
      // Subscribe to updates
      const unsubscribe = snowflakeService.subscribeToRevenueUpdates((data) => {
        // Update your component state with the new data
        setRevenueData(data);
      });

      // Cleanup on unmount
      return () => unsubscribe();
    })
    .catch(error => {
      console.error('Failed to initialize Snowflake:', error);
    });
}, []);
*/
