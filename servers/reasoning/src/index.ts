import express from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', chatRouter);

app.listen(port, () => {
  console.log(`Reasoning server running at http://localhost:${port}`);
});
