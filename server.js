import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Allow both production domain and local dev
const allowedOrigins = ['https://app.microfix.dk', 'http://localhost:5173', 'http://localhost:4173'];
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            // Optionally allow all for debugging if strictness causes issues:
            // return callback(null, true);
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
}));
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'dist')));

const { Pool } = pg;

// SSL configuration:
// Only use SSL if explicitly requested via DATABASE_URL query param (sslmode) or DB_SSL env var.
// We do not force it for non-localhost anymore, as internal container networks (like Coolify) often don't use SSL.
const getSSLConfig = (str) => {
    if (process.env.DB_SSL === 'true') return { rejectUnauthorized: false };

    // If the URL string explicitly mentions sslmode, we might need to handle it, 
    // but 'pg' parses connectionString automatically. 
    // However, for self-signed certs with sslmode=require, we might need rejectUnauthorized: false.
    if (str && (str.includes('sslmode=require') || str.includes('sslmode=verify-full'))) {
        return { rejectUnauthorized: false };
    }

    return false;
};

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: getSSLConfig(process.env.DATABASE_URL)
    }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        ssl: (process.env.DB_HOST === 'localhost' || !process.env.DB_HOST) ? false : { rejectUnauthorized: false }
    };

console.log('Database Configuration:', {
    ...poolConfig,
    password: poolConfig.password ? '****' : undefined,
    connectionString: poolConfig.connectionString ? 'Has Connection String' : undefined
});

const pool = new Pool(poolConfig);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/setup-db', async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            await client.query(`
        CREATE TABLE IF NOT EXISTS links (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          description TEXT,
          imageUrl TEXT,
          tags TEXT[],
          createdAt BIGINT NOT NULL
        );
      `);
            res.json({ success: true, message: 'Table "links" created or already exists.' });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
// NOTE: We use /.*/ regex because Express 5's path-to-regexp no longer supports '*' as a wildcard.
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
