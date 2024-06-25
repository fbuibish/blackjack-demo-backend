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

    const aiAssistedRounds = rounds.filter((round) => round.aiAssisted);
    const manualRounds = rounds.filter((round) => !round.aiAssisted);

    let aiHandTotal = 0;
    let aiStackTotal = 0;
    aiAssistedRounds.forEach(aiRound => {
      aiHandTotal = aiHandTotal + aiRound.hands.length;
      aiStackTotal = aiStackTotal + aiRound.stack;
    });

    let manualHandTotal = 0;
    let manualStackTotal = 0;
    manualRounds.forEach(mRound => {
      manualHandTotal = manualHandTotal + mRound.hands.length;
      manualStackTotal = manualStackTotal + mRound.stack;
    });

    return res.json({
      rounds,
      stats: {
        aiAvgHands: (aiHandTotal / aiAssistedRounds.length).toFixed(1),
        aiAvgStack: (aiStackTotal / aiAssistedRounds.length).toFixed(0),
        playerAvgHands: (manualHandTotal / manualRounds.length).toFixed(1),
        playerAvgStack: (manualStackTotal / manualRounds.length).toFixed(0),
      },
    });
  } catch (error) {
    console.error('Error fetching round:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
