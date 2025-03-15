import Papa from "papaparse";
import { RevenueData } from "../types/revenue";

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
            austinRevenue: parseFloat(row["Austin Revenue"]),
            charlotteRevenue: parseFloat(row["Charlotte Revenue"]),
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
    "Austin Revenue": row.austinRevenue,
    "Charlotte Revenue": row.charlotteRevenue,
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
