const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const API_KEY = process.env.API_KEY;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI environment variable.');
  process.exit(1);
}
if (!API_KEY) {
  console.error('Missing API_KEY environment variable.');
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI);
let collection;

async function start() {
  await client.connect();
  const db = client.db('workspace_app');
  collection = db.collection('data');
  console.log('Connected to MongoDB');

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  // Simple shared-secret auth. Every request must include this header.
  app.use((req, res, next) => {
    const key = req.header('x-api-key');
    if (key !== API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });

  // Fetch the whole workspace blob.
  app.get('/api/data', async (req, res) => {
    try {
      const doc = await collection.findOne({ _id: 'main' });
      res.json(doc ? doc.data : { pages: [], activePageId: null });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to read data' });
    }
  });

  // Replace the whole workspace blob. Mirrors the old localStorage.setItem call.
  app.put('/api/data', async (req, res) => {
    try {
      const data = req.body;
      if (!data || !Array.isArray(data.pages)) {
        return res.status(400).json({ error: 'Invalid data shape' });
      }
      await collection.updateOne(
        { _id: 'main' },
        { $set: { data, updatedAt: new Date() } },
        { upsert: true }
      );
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to save data' });
    }
  });

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
