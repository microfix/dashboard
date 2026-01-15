import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
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

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
