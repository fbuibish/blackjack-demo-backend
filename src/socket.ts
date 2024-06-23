// src/socket.ts
import { Server } from 'socket.io';
import prisma from './utils/prisma';
import { initializeShoe, drawCard, calculateHandValue, Card } from './utils/cardUtils';

const io = new Server(3001, {
  cors: {
    origin: '*',
  },
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('startRound', async (data) => {
    const { userId, aiAssisted } = data;
    const shoe = initializeShoe();

    const round = await prisma.round.create({
      data: {
        userId,
        shoe: JSON.stringify(shoe),
        score: 0,
        aiAssisted,
      },
    });

    const newHand = await createNewHand(round.id, shoe);

    socket.join(`round_${round.id}`);
    socket.emit('roundStarted', { roundId: round.id, ...newHand });
  });

  socket.on('playerAction', async (data) => {
    console.log('playerAction received:', data);
    const { roundId, action } = data;
  
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
      socket.emit('handResult', { outcome: 'lose' });
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
      } else if (playerTotal < dealerTotal) {
        outcome = 'lose';
      }
  
      await prisma.hand.update({
        where: { id: hand.id },
        data: { outcome },
      });
      socket.emit('handResult', { outcome });
      console.log('handResult sent:', { outcome });
      socket.emit('nextHand', { roundId }); // Emit nextHand event
    }
  });  

  socket.on('nextHand', async (data) => {
    const { roundId } = data;

    const round = await prisma.round.findUnique({
      where: { id: roundId },
    });

    if (!round) {
      socket.emit('error', 'Round not found');
      return;
    }

    const shoe: Card[] = JSON.parse(round.shoe);
    const newHand = await createNewHand(round.id, shoe);

    socket.emit('handStarted', newHand);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const createNewHand = async (roundId: number, shoe: Card[]) => {
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
    },
  });

  const dealerCardGroup = await prisma.cardGroup.create({
    data: {
      handId: hand.id,
      cards: JSON.stringify(dealerHand),
      isSplit: true,
    },
  });

  await prisma.round.update({
    where: { id: roundId },
    data: { shoe: JSON.stringify(shoeAfterDealerCard2) },
  });

  return {
    playerHand,
    dealerHand,
  };
};
