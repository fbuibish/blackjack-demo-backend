// src/routes/round.ts
import express from 'express';
import prisma from '../utils/prisma';

const router = express.Router();

router.get('/round/:roundId', async (req, res) => {
  const { roundId } = req.params;

  try {
    const round = await prisma.round.findUnique({
      where: { id: parseInt(roundId, 10) },
      include: {
        hands: {
          include: {
            playerHands: true,
          },
        },
      },
    });

    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    return res.json({
      round,
      hands: round.hands,
      finalStack: round.stack,
    });
  } catch (error) {
    console.error('Error fetching round:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
