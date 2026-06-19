import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

// Create a single pool instance for application use
const pool = new Pool({
  connectionString,
});

// Function to initialize the database
export const initializeDatabase = async () => {
  // Extract base connection string (to default 'postgres' database) to check/create the target database
  const matches = connectionString.match(/postgresql:\/\/([^:]+):([^@]+)@([^:/]+):?([0-9]*)\/(.+)/);
  if (!matches) {
    console.error('Invalid DATABASE_URL format in .env');
    process.exit(1);
  }

  const [, user, password, host, port, dbName] = matches;
  const targetDb = dbName.split('?')[0];

  // Create temporary pool connecting to the default 'postgres' database
  const adminPool = new Pool({
    user,
    password,
    host,
    port: port ? parseInt(port) : 5432,
    database: 'postgres',
  });

  try {
    // Check if database exists
    const dbCheck = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [targetDb]
    );

    if (dbCheck.rowCount === 0) {
      console.log(`Database '${targetDb}' does not exist. Creating...`);
      await adminPool.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`Database '${targetDb}' created successfully.`);
    }
  } catch (error) {
    console.error('Error checking or creating database:', error);
  } finally {
    await adminPool.end();
  }

  try {
    console.log('Connecting to target database and initializing tables...');
    
    // Create pgcrypto extension for gen_random_uuid() if not exists
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    // Create teachers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        designation VARCHAR(255) NOT NULL,
        department VARCHAR(255) NOT NULL,
        cabin_number VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'AVAILABLE',
        status_notice VARCHAR(255),
        timetable_url VARCHAR(255),
        schedule_data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create chat_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        query TEXT NOT NULL,
        matched_teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
        intent VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create allowed_teachers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS allowed_teachers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables verified/created successfully.');
  } catch (error) {
    console.error('Error initializing tables:', error);
    process.exit(1);
  }
};

export default pool;
