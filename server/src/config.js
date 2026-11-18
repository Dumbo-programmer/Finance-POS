import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  dbClient: (process.env.DB_CLIENT || 'sqlite').toLowerCase(),
  databaseUrl: process.env.DATABASE_URL || '',
  sqlitePath: process.env.SQLITE_PATH || './data/local.db',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  schoolName: process.env.SCHOOL_NAME || 'Northfield Academy',
};
