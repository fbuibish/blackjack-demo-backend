// src/index.ts
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import userRoutes from './routes/user';
import gameRoutes from './routes/game';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.use('/api/user', userRoutes);
app.use('/api/game', gameRoutes);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
