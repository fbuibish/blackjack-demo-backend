// src/controllers/gameController.ts
import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { initializeShoe, drawCard, calculateHandValue, Card, Suit } from '../utils/cards';

export const createGame = async (req: Request, res: Response) => {
  try {
    const game = await prisma.game.create({
      data: req.body,
    });
    res.status(201).json({ success: true, data: game });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getGames = async (_req: Request, res: Response) => {
  try {
    const games = await prisma.game.findMany({
      include: { user: true },
    });
    res.status(200).json({ success: true, data: games });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const simulateGame = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    let shoe = initializeShoe();

    // Draw initial hands
    let { card: playerCard1, remainingShoe: shoeAfterPlayerCard1 } = drawCard(shoe);
    let { card: playerCard2, remainingShoe: shoeAfterPlayerCard2 } = drawCard(shoeAfterPlayerCard1);
    let { card: dealerCard1, remainingShoe: shoeAfterDealerCard1 } = drawCard(shoeAfterPlayerCard2);
    let { card: dealerCard2, remainingShoe: shoeAfterDealerCard2 } = drawCard(shoeAfterDealerCard1);

    const playerHand = [playerCard1, playerCard2];
    const dealerHand = [dealerCard1, { value: 0, suit: 'Hidden' as Suit }];

    const game = await prisma.game.create({
      data: {
        userId,
        shoe: JSON.stringify(shoeAfterDealerCard2), // Save the remaining shoe to the database
        score: 0, // Initial score, update after game is complete
        aiAssisted: false,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        gameId: game.id,
        playerHand,
        dealerHand,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const handlePlayerAction = async (req: Request, res: Response) => {
  try {
    const { gameId, action, currentPlayerHand, dealerHand } = req.body;

    // Fetch the game and shoe from the database
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' });
    }

    let shoe: Card[] = JSON.parse(game.shoe);
    let playerHand = [...currentPlayerHand];
    let newDealerHand = [...dealerHand];
    let outcome = null;

    if (action === 'hit') {
      const { card: newCard, remainingShoe } = drawCard(shoe);
      shoe = remainingShoe;
      playerHand.push(newCard);
    }

    const playerTotal = calculateHandValue(playerHand);
    let dealerTotal = calculateHandValue(newDealerHand);

    if (playerTotal > 21) {
      outcome = 'lose';
    }

    if (action === 'stand' || playerTotal > 21) {
      // Reveal dealer's hidden card
      newDealerHand = newDealerHand.map(card => card.suit === 'Hidden' ? drawCard(shoe).card : card);
      shoe = shoe.filter(card => card.suit !== 'Hidden'); // Remove the hidden card from the shoe
      dealerTotal = calculateHandValue(newDealerHand);

      while (dealerTotal < 17) {
        const { card: newCard, remainingShoe } = drawCard(shoe);
        shoe = remainingShoe;
        newDealerHand.push(newCard);
        dealerTotal = calculateHandValue(newDealerHand);
      }

      if (dealerTotal === 21) {
        outcome = 'lose';
      } else if (dealerTotal > 21 || playerTotal > dealerTotal) {
        outcome = 'win';
      } else if (playerTotal < dealerTotal) {
        outcome = 'lose';
      } else {
        outcome = 'push';
      }
    }

    if (outcome) {
      // Deal a new hand if outcome is determined
      const { card: newPlayerCard1, remainingShoe: shoeAfterNewPlayerCard1 } = drawCard(shoe);
      const { card: newPlayerCard2, remainingShoe: shoeAfterNewPlayerCard2 } = drawCard(shoeAfterNewPlayerCard1);
      const { card: newDealerCard1, remainingShoe: shoeAfterNewDealerCard1 } = drawCard(shoeAfterNewPlayerCard2);
      const { card: newDealerCard2, remainingShoe: shoeAfterNewDealerCard2 } = drawCard(shoeAfterNewDealerCard1);

      shoe = shoeAfterNewDealerCard2;

      const newPlayerHand = [newPlayerCard1, newPlayerCard2];
      const newDealerHand = [newDealerCard1, { value: 0, suit: 'Hidden' as Suit }];

      await prisma.game.update({
        where: { id: gameId },
        data: { shoe: JSON.stringify(shoe) },
      });

      return res.status(200).json({
        success: true,
        outcome,
        playerHand,
        dealerHand: newDealerHand,
        newPlayerHand,
        newDealerHand,
      });
    } else {
      await prisma.game.update({
        where: { id: gameId },
        data: { shoe: JSON.stringify(shoe) },
      });

      return res.status(200).json({
        success: true,
        playerHand,
        dealerHand: newDealerHand,
      });
    }
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};
