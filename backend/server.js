import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import scanRoutes from './routes/scan.js';
import resultRoutes from './routes/results.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' })); // tighten this before production
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/scan', scanRoutes);
app.use('/api/results', resultRoutes);

app.listen(PORT, () => {
  console.log(`Visaion backend running on http://localhost:${PORT}`);
});
