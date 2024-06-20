// src/routes/game.ts
import { Router } from 'express';
import { createGame, getGames, simulateGame, handlePlayerAction } from '../controllers/gameController';

const router = Router();

router.post('/', createGame);
router.get('/', getGames);
router.post('/simulate', simulateGame);
router.post('/action', handlePlayerAction);

export default router;
