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
// Allow production domains (including subdomains) and local dev
const allowedOrigins = ['http://localhost:5173', 'http://localhost:4173'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Allow localhost
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        }

        // Allow any subdomain of microfix.dk (e.g. app.microfix.dk, dashboard.microfix.dk)
        // Also allow the new domain structure naturally.
        if (origin.endsWith('microfix.dk')) {
            return callback(null, true);
        }

        // Use this stricter log for debugging if needed, but for now we are permissive with the domain
        console.log('[CORS] Blocked origin:', origin);
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
    }
}));
app.use(express.json());

// Debug logging to see exactly what the server receives
app.use((req, res, next) => {
    console.log(`[DEBUG] Request: ${req.method} ${req.url} | Path: ${req.path}`);
    next();
});

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

// API Endpoints for Links

// GET all links
app.get('/api/links', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM links ORDER BY createdAt DESC');
        // Convert createdAt from string/bigint to number for frontend compatibility if needed
        const links = result.rows.map(row => ({
            ...row,
            createdAt: Number(row.createdat) // PostgreSQL might return bigint as string
        }));
        res.json(links);
    } catch (err) {
        console.error('Error fetching links:', err);
        res.status(500).json({ error: 'Failed to fetch links' });
    }
});

// CREATE a new link
app.post('/api/links', async (req, res) => {
    const { title, url, description, imageUrl, tags, createdAt } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO links (title, url, description, imageUrl, tags, createdAt) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [title, url, description, imageUrl, tags, createdAt]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error creating link:', err);
        res.status(500).json({ error: 'Failed to create link' });
    }
});

// UPDATE a link
app.put('/api/links/:id', async (req, res) => {
    const { id } = req.params;
    const { title, url, description, imageUrl, tags } = req.body;
    try {
        const result = await pool.query(
            'UPDATE links SET title = COALESCE($1, title), url = COALESCE($2, url), description = COALESCE($3, description), imageUrl = COALESCE($4, imageUrl), tags = COALESCE($5, tags) WHERE id = $6 RETURNING *',
            [title, url, description, imageUrl, tags, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Link not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating link:', err);
        res.status(500).json({ error: 'Failed to update link' });
    }
});

// DELETE a link
app.delete('/api/links/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM links WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Link not found' });
        }
        res.json({ success: true, deletedId: id });
    } catch (err) {
        console.error('Error deleting link:', err);
        res.status(500).json({ error: 'Failed to delete link' });
    }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
// NOTE: We use a Negative Lookahead Regex to explicitly exclude /pdffilesize and /api
// This ensures that requests to those paths are NOT handled by this route.
app.get(/^(?!\/pdffilesize|\/api).*$/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
