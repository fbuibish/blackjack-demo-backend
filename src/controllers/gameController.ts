import prisma from '../utils/prisma';
import { initializeShoe, drawCard, calculateHandValue, Card } from '../utils/cardUtils';
import { Server } from 'socket.io';

export const setupGameSocket = (io: Server) => {
  io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('startRound', async (data) => {
      console.log('startRound received:', data);
      const { userId, aiAssisted } = data;
      const shoe = initializeShoe();

      const round = await prisma.round.create({
        data: {
          userId,
          shoe: JSON.stringify(shoe),
          aiAssisted,
          stack: 1000, // Initialize stack
        },
      });

      socket.join(`round_${round.id}`);
      socket.emit('roundStarted', { roundId: round.id });
      console.log('roundStarted sent:', { roundId: round.id });
    });

    socket.on('playerAction', async (data) => {
      console.log('playerAction received:', data);
      const { roundId, action, wager } = data;

      const round = await prisma.round.findUnique({
        where: { id: roundId },
      });

      if (!round) {
        socket.emit('error', 'Round not found');
        console.log('error: Round not found');
        return;
      }

      let shoe: Card[] = JSON.parse(round.shoe);
      const hand = await prisma.hand.findFirst({
        where: { roundId },
        orderBy: { createdAt: 'desc' },
        include: { cardGroups: true },
      });

      if (!hand) {
        socket.emit('error', 'Hand not found');
        console.log('error: Hand not found');
        return;
      }

      const playerCardGroup = hand.cardGroups.find((group) => !group.isSplit);
      const dealerCardGroup = hand.cardGroups.find((group) => group.isSplit);

      if (!playerCardGroup || !dealerCardGroup) {
        socket.emit('error', 'Card groups not found');
        console.log('error: Card groups not found');
        return;
      }

      let playerCards: Card[] = JSON.parse(playerCardGroup.cards);
      let dealerCards: Card[] = JSON.parse(dealerCardGroup.cards);

      if (action === 'hit') {
        const { card: newCard, remainingShoe } = drawCard(shoe);
        playerCards.push(newCard);
        await prisma.cardGroup.update({
          where: { id: playerCardGroup.id },
          data: { cards: JSON.stringify(playerCards) },
        });
        await prisma.round.update({
          where: { id: roundId },
          data: { shoe: JSON.stringify(remainingShoe) },
        });

        socket.emit('cardDealt', { recipient: 'player', card: newCard });
        console.log('cardDealt sent:', { recipient: 'player', card: newCard });
      }

      const playerTotal = calculateHandValue(playerCards);
      let dealerTotal = calculateHandValue(dealerCards);

      if (playerTotal > 21) {
        await prisma.hand.update({
          where: { id: hand.id },
          data: { outcome: 'lose' },
        });
        await prisma.round.update({
          where: { id: roundId },
          data: { stack: round.stack - playerCardGroup.wager }, // Deduct wager from stack
        });
        socket.emit('handResult', { handId: hand.id, outcome: 'lose', stack: round.stack - playerCardGroup.wager });
        console.log('handResult sent:', { outcome: 'lose' });
        socket.emit('nextHand', { roundId }); // Emit nextHand event
        return;
      }

      if (action === 'stand') {
        while (dealerTotal < 17) {
          const { card: newCard, remainingShoe } = drawCard(shoe);
          dealerCards.push(newCard);
          dealerTotal = calculateHandValue(dealerCards);
          await prisma.round.update({
            where: { id: roundId },
            data: { shoe: JSON.stringify(remainingShoe) },
          });
          socket.emit('cardDealt', { recipient: 'dealer', card: newCard });
          console.log('cardDealt sent:', { recipient: 'dealer', card: newCard });
        }

        let outcome = 'push';
        if (dealerTotal > 21 || playerTotal > dealerTotal) {
          outcome = 'win';
          await prisma.round.update({
            where: { id: roundId },
            data: { stack: round.stack + playerCardGroup.wager * 2 }, // Add wager to stack
          });
        } else if (playerTotal < dealerTotal) {
          outcome = 'lose';
          await prisma.round.update({
            where: { id: roundId },
            data: { stack: round.stack - playerCardGroup.wager }, // Deduct wager from stack
          });
        }

        await prisma.hand.update({
          where: { id: hand.id },
          data: { outcome },
        });
        socket.emit('handResult', { outcome, stack: round.stack });
        console.log('handResult sent:', { outcome, stack: round.stack });
        socket.emit('nextHand', { roundId }); // Emit nextHand event
      }
    });

    socket.on('nextHand', async (data) => {
      console.log('nextHand received:', data);
      const { roundId, wager } = data;

      const round = await prisma.round.findUnique({
        where: { id: roundId },
      });

      if (!round) {
        socket.emit('error', 'Round not found');
        console.log('error: Round not found');
        return;
      }

      const shoe: Card[] = JSON.parse(round.shoe);
      const newHand = await createNewHand(round.id, shoe, wager, io);

      socket.emit('handStarted', newHand);
      console.log('handStarted sent:', newHand);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });
};

const saveResult = async (roundId: number, handId: number, cardGroupId: number, outcome: 'win' | 'lose' | 'push', isBlackJack: boolean = false) => {
  await prisma.hand.update({
    where: { id:handId },
    data: { outcome },
  });

  const round = await prisma.round.findFirst({ where: { id: roundId }});
  const cardGroup = await prisma.cardGroup.findFirst({ where: { id: cardGroupId }});
  if (!round || !cardGroup) {
    throw ('Error updating result of hand');
  }

  let updatedStackAmount = round.stack + cardGroup.wager * 2;
  if (isBlackJack) {
    updatedStackAmount = round.stack + cardGroup.wager * 2 + Math.round(cardGroup.wager / 2)
  }

  await prisma.round.update({
    where: { id: roundId },
    data: { stack: updatedStackAmount }, // Add wager to stack
  });
}

const createNewHand = async (roundId: number, shoe: Card[], wager: number, io: Server) => {
  let { card: playerCard1, remainingShoe: shoeAfterPlayerCard1 } = drawCard(shoe);
  let { card: playerCard2, remainingShoe: shoeAfterPlayerCard2 } = drawCard(shoeAfterPlayerCard1);
  let { card: dealerCard1, remainingShoe: shoeAfterDealerCard1 } = drawCard(shoeAfterPlayerCard2);
  let { card: dealerCard2, remainingShoe: shoeAfterDealerCard2 } = drawCard(shoeAfterDealerCard1);

  const playerHand = [playerCard1, playerCard2];
  const dealerHand = [dealerCard1, dealerCard2];

  const hand = await prisma.hand.create({
    data: {
      roundId,
      outcome: '',
    },
  });

  const playerCardGroup = await prisma.cardGroup.create({
    data: {
      handId: hand.id,
      cards: JSON.stringify(playerHand),
      isSplit: false,
      wager,
    },
  });

  const dealerCardGroup = await prisma.cardGroup.create({
    data: {
      handId: hand.id,
      cards: JSON.stringify(dealerHand),
      isSplit: true,
      wager: 0,
    },
  });

  await prisma.round.update({
    where: { id: roundId },
    data: { shoe: JSON.stringify(shoeAfterDealerCard2) },
  });

  const dealerTotal = calculateHandValue(dealerHand);
  const playerTotal = calculateHandValue(playerHand);

  console.log('createNewHand:', { playerHand, dealerHand });
  if (playerTotal === 21 && playerHand.length === 2 && 
    dealerTotal === 21 && dealerHand.length === 2 ) {
      await saveResult(roundId, hand.id, playerCardGroup.id, 'push');

    io.to(`round_${roundId}`).emit('handResult', { outcome: 'push' });
    console.log('Both Player and dealer have blackjack. Hand result sent:', { outcome: 'push' });
    return { playerHand, dealerHand };
  }
  else if (playerTotal === 21 && playerHand.length === 2) {
    await saveResult(roundId, hand.id, playerCardGroup.id, 'win', true);
    io.to(`round_${roundId}`).emit('handResult', { outcome: 'win' });
    console.log('Player has blackjack. Hand result sent:', { outcome: 'win' });
    return { playerHand, dealerHand };
  }
  else if (dealerTotal === 21 && dealerHand.length === 2) {
    await saveResult(roundId, hand.id, playerCardGroup.id, 'lose');
    io.to(`round_${roundId}`).emit('handResult', { outcome: 'lose' });
    console.log('Dealer has blackjack. Hand result sent:', { outcome: 'lose' });
    return { playerHand, dealerHand };
  }

  return {
    playerHand,
    dealerHand,
  };
};
