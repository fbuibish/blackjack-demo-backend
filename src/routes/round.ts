// src/routes/round.ts
import express from 'express';
import prisma from '../utils/prisma';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rounds = await prisma.round.findMany({
      include: {
        user: true,
        hands: {
          include: {
            playerHands: true,
          },
        },
      },
      orderBy: {
        stack: 'desc',
      },
    });

    if (!rounds) {
      return res.status(404).json({ error: 'Round not found' });
    }

    return res.json({
      rounds,
    });
  } catch (error) {
    console.error('Error fetching round:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
