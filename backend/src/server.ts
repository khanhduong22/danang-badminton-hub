import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { startCrawlerCron } from './cron/crawlerJob';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Basic endpoints
app.get('/api/courts', async (req, res) => {
  try {
    const courts = await prisma.court.findMany();
    res.json(courts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch courts' });
  }
});

app.get('/api/wandering-posts', async (req, res) => {
  try {
    const posts = await prisma.wanderingPost.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        court: true
      }
    });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wandering posts' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend is running on http://localhost:${PORT}`);
  
  // Khởi động cron job cào dữ liệu
  startCrawlerCron();
});
