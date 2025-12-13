import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import caseRoutes from './routes/case.js';
import juryRoutes from './routes/jury.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// For serving uploaded files if needed later
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/', (req, res) => {
  res.json({ message: 'Chef\'s Court of Justice API' });
});

app.use('/auth', authRoutes);
app.use('/case', caseRoutes);
app.use('/jury', juryRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
