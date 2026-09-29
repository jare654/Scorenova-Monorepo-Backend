import { DataSource, DataSourceOptions } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

// SSL is required on Render (DATABASE_URL is always present there).
// Locally, DATABASE_URL is typically not set, so SSL is skipped.
const useSSL = !!(process.env.DATABASE_URL || process.env.DATABASE_SSL === "true");

export const dataSourceOptions: DataSourceOptions = {
  type: "postgres",
  ...(process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DATABASE_HOST,
        username: process.env.DATABASE_USERNAME,
        password: process.env.DATABASE_PASSWORD,
        port: Number(process.env.DATABASE_PORT) || 5432,
        database: process.env.DATABASE_NAME,
      }),
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  connectTimeoutMS: 10000,
  entities: ["dist/**/*.entity.js"],
  migrations: ["dist/db/migrations/*.js"],
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
