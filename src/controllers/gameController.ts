import prisma from '../utils/prisma';
import { initializeShoe, drawCard, calculateHandValue, Card } from '../utils/cardUtils';
import { Server } from 'socket.io';

const getGameState = async (roundId: number) => {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      hands: {
        include: {
          playerHands: {
            orderBy: {
              id: 'desc'
            }
          },
          dealerHand: true,
        },
      },
    },
  });

  if (!round) throw new Error('Round not found');

  let availableActions = ['placeWager'];

  const [activeHand] = round.hands.filter(hand => hand.isActive);
  let activePlayerHands, activeDealerHand, activePlayerHandId;
  if (activeHand) {
    activePlayerHands = activeHand.playerHands.filter(playerHand => !playerHand.outcome);
    activeDealerHand = activeHand.dealerHand;

    if (!activePlayerHands || !activeDealerHand) {
      throw Error('hands cannot be found for an active hand');
    }

    const dealerCards = JSON.parse(activeDealerHand.cards);
    const dealerTotal = calculateHandValue(dealerCards)

    if (activePlayerHands.length === 1) {
      const activePlayerHand = activePlayerHands[0];
      const playerCards = JSON.parse(activePlayerHands[0].cards);
      if (playerCards.length === 2 && dealerCards.length === 2) {
        const playerTotal = calculateHandValue(playerCards);

        if (dealerTotal === 21 && playerTotal === 21) {
          await prisma.playerHand.update({ where: { id: activePlayerHand.id }, data: { outcome: 'push' }});
        }
        if (playerTotal === 21) {
          await prisma.playerHand.update({ where: { id: activePlayerHand.id }, data: { outcome: 'blackjack' }});
        }
        if (dealerTotal === 21) {
          await prisma.playerHand.update({ where: { id: activePlayerHand.id }, data: { outcome: 'lose' }});
        }
      }
    }

    // see if any player hands are bust
    for (const activePlayerHand of activePlayerHands) {
      const playerCards = JSON.parse(activePlayerHand.cards);
      if (calculateHandValue(playerCards) > 21) {
        await prisma.playerHand.update({ where: { id: activePlayerHand.id }, data: { outcome: 'lose' }});
      }
    }

    // do we need anymore actions?
    const awaitingPlayerActions = await prisma.playerHand.findMany({
      where: { 
        handId: activeHand.id,
        outcome: null,
        playerDone: false,
      },
      orderBy: {
        id: 'asc',
      },
    });

    // TODO: put in logic to prevent action if wager > stack
    if (awaitingPlayerActions.length > 0) {
      availableActions = ['hit', 'stand', 'double'];
      const activePlayerHand = awaitingPlayerActions[0];
      activePlayerHandId = activePlayerHand.id;
      const playerCards = JSON.parse(activePlayerHand.cards);

      if (playerCards.length === 2 && playerCards[0].value === playerCards[1].value) {
        availableActions.push('split');
      }
    } else {
      const waitingDealerOutcome = await prisma.playerHand.findMany({
        where: {
          handId: activeHand.id,
          outcome: null,
        }
      })

      // ready for dealer?
      if (waitingDealerOutcome.length > 0) {
        let shoe = JSON.parse(round.shoe);
        let dealerTotal = calculateHandValue(dealerCards);

        while(dealerTotal < 17) {
          const { card: newCard, remainingShoe } = drawCard(shoe);
          dealerCards.push(newCard);
          dealerTotal = calculateHandValue(dealerCards);
          await prisma.round.update({
            where: { id: roundId },
            data: { shoe: JSON.stringify(remainingShoe) },
          });
        }

        await prisma.dealerHand.update({ where: { id: activeDealerHand.id }, data: { cards: JSON.stringify(dealerCards) }});
      }

      // calculate payouts
      const notLosingPlayerHands = await prisma.playerHand.findMany({
        where: {
          handId: activeHand.id,
          OR: [
            { outcome: 'blackjack' },
            { outcome: 'win' },
            { outcome: 'push' },
            { outcome: null },
          ],
        },
      });
      const dealerHand = await prisma.dealerHand.findFirstOrThrow({
        where: { id: activeDealerHand.id },
      });

      const dealerTotal = calculateHandValue(JSON.parse(dealerHand.cards));

      for (const playerHand of notLosingPlayerHands) {
        const playerTotal = calculateHandValue(JSON.parse(playerHand.cards));
        if (playerHand.outcome === 'blackjack') {
          const payout = calculatePayout(playerHand.wager, 'blackjack');
          await prisma.playerHand.update({
            where: { id: playerHand.id }, data: { outcome: 'win', stackDiff: payout - playerHand.wager}
          });
          await prisma.round.update({
            where: { id: round.id },
            data: {
              stack: round.stack + payout,
            }
          });
        }
        if (dealerTotal > 21 || playerTotal > dealerTotal) {
          const payout = calculatePayout(playerHand.wager, 'standard');
          await prisma.playerHand.update({
            where: { id: playerHand.id }, data: { outcome: 'win', stackDiff: payout - playerHand.wager}
          });
          await prisma.round.update({
            where: { id: round.id },
            data: {
              stack: round.stack + payout,
            }
          });
        } else if (playerTotal === dealerTotal) {
          await prisma.playerHand.update({
            where: { id: playerHand.id }, data: { outcome: 'push', stackDiff: 0 }
          })
          await prisma.round.update({
            where: { id: round.id },
            data: {
              stack: round.stack + playerHand.wager,
            }
          });
        } else {
          await prisma.playerHand.update({
            where: { id: playerHand.id }, data: { outcome: 'lose', stackDiff: playerHand.wager * -1 }
          });
        }
      }

      await prisma.hand.update({
        where: { id: activeHand.id },
        data: { isActive: false },
      });
    }

    activeDealerHand = await prisma.dealerHand.findFirstOrThrow({
      where: { handId: activeHand.id },
    })
  }

  const updatedRound = await prisma.round.findUniqueOrThrow({
    where: { id: roundId },
    include: {
      hands: {
        orderBy: {
          id: 'desc',
        },
        include: {
          playerHands: {
            orderBy: {
              id: 'desc'
            }
          },
          dealerHand: true,
        },
      },
    },
  });

  const finishedHands = updatedRound.hands.filter(hand => !hand.isActive);
  let parsedFinishedHands: any[] = [];
  finishedHands.map(hand => {
    const dealerHand = { ...hand.dealerHand, cards: hand.dealerHand && JSON.parse(hand.dealerHand.cards) };
    parsedFinishedHands = parsedFinishedHands.concat(hand.playerHands.map(ph => ({ ...ph, cards: JSON.parse(ph.cards), dealerHand})))
  })

  return {
    roundId: round.id,
    stack: round.stack,
    activePlayerHandId: activePlayerHandId,
    playerHands: activePlayerHands && activePlayerHands.map(ph => ({ ...ph, cards: JSON.parse(ph.cards)})),
    dealerHand: activeDealerHand && { ...activeDealerHand, cards: JSON.parse(activeDealerHand.cards)},
    availableActions,
    finishedHands: parsedFinishedHands,
  }
};

const calculatePayout = (wager: number, winType: 'standard' | 'blackjack') => {
  if(winType === 'standard') {
    return wager * 2;
  } else {
    return wager * 2 + Math.round(wager / 2);
  }
}

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

      const gameState = await getGameState(round.id);
      socket.join(`round_${round.id}`);
      socket.emit('gameState', gameState);
      console.log('gameState sent:', gameState);
    });

    socket.on('playerAction', async (data) => {
      console.log('playerAction received:', data);
      const { roundId, playerHandId, action, wager } = data;

      const round = await prisma.round.findUnique({
        where: { id: roundId },
        include: { 
          hands: {
            include: { 
              playerHands: {
                where: {
                  id: playerHandId,
                },
              },
              dealerHand: true,
            },
            where: {
              isActive: true,
            },
          } 
        },
      });

      if (!round) {
        socket.emit('error', 'Round not found');
        console.log('error: Round not found');
        return;
      }

      let shoe: Card[] = JSON.parse(round.shoe);
      let activeHand;
      const { hands } = round;
      if (hands.length > 1) {
        throw Error('how do we have 2 open hands');
      } else if (hands.length === 1) {
        activeHand = hands[0];
      }

      if (!activeHand || action === 'placeWager') {
        round.stack -= wager;
        await prisma.round.update({ where: { id: roundId }, data: { stack: round.stack } });
        const { playerCardGroups, dealerCardGroup, newHand } = await createNewHand(roundId, JSON.parse(round.shoe), wager);

        const dealerCards = JSON.parse(dealerCardGroup.cards);
        const playerCards = JSON.parse(playerCardGroups[0].cards)
        const dealerTotal = calculateHandValue(dealerCards);
        const playerTotal = calculateHandValue(playerCards);

        if (playerTotal === 21 || dealerTotal === 21) {
          let outcome = '';
      
          if (playerTotal === 21 && dealerTotal === 21) {
            outcome = 'push';
            console.log('Both Player and dealer have blackjack. Hand result sent:', { outcome: 'push' });
          }
          if (playerTotal === 21) {
            outcome = 'win'
            console.log('Player has blackjack. Hand result sent:', { outcome: 'win' });
          }
          if (dealerTotal === 21) {
            outcome = 'lose'
            console.log('Dealer has blackjack. Hand result sent:', { outcome: 'lose' }); 
          }

          // await prisma.hand.update({
          //   where: { id: newHand.id },
          //   data: { isActive: false },
          // });
          console.log('Blackjack!. Hand result sent:', { outcome });
        }

        socket.emit('gameState', await getGameState(roundId));
        console.log('gameState sent after wager:', await getGameState(roundId));
        return;
      }

      const [activePlayerHand] = activeHand.playerHands;
      const activeDealerHand = activeHand.dealerHand;

      if (!activePlayerHand || !activeDealerHand) {
        socket.emit('error', 'Card groups not found');
        console.log('error: Card groups not found');
        return;
      }

      let playerCards: Card[] = JSON.parse(activePlayerHand.cards);

      if (action === 'hit') {
        const { card: newCard, remainingShoe } = drawCard(shoe);
        playerCards.push(newCard);
        await prisma.playerHand.update({ where: { id: activePlayerHand.id }, data: { cards: JSON.stringify(playerCards) } });
        await prisma.round.update({ where: { id: roundId }, data: { shoe: JSON.stringify(remainingShoe) } });
      } else if (action === 'stand') {
        await prisma.playerHand.update({ where: { id: activePlayerHand.id }, data: { playerDone: true }});
      } else if (action === 'double') {
        round.stack -= activePlayerHand.wager;
        const { card: newCard, remainingShoe } = drawCard(shoe);
        playerCards.push(newCard);
        await prisma.round.update({ where: { id: roundId }, data: { shoe: JSON.stringify(remainingShoe), stack: round.stack } });
        await prisma.playerHand.update({ 
          where: { id: activePlayerHand.id }, 
          data: { cards: JSON.stringify(playerCards), playerDone: true, wager: activePlayerHand.wager * 2 } });
      } else if (action === 'split') {
        const [playerCard1, playerCard2] = playerCards;

        round.stack -= activePlayerHand.wager;
        const { card: newCard1, remainingShoe: remainingShoe1 } = drawCard(shoe);
        await prisma.round.update({ where: { id: roundId }, data: { shoe: JSON.stringify(remainingShoe1), stack: round.stack } });

        await prisma.playerHand.update({ where: { id: activePlayerHand.id }, data: { cards: JSON.stringify([playerCard1, newCard1]) } });

        const { card: newCard2, remainingShoe: remainingShoe2 } = drawCard(remainingShoe1);
        await prisma.round.update({ where: { id: roundId }, data: { shoe: JSON.stringify(remainingShoe2), stack: round.stack } });
        // create new player hand 
        await prisma.playerHand.create({
          data: {
            handId: activeHand.id,
            cards: JSON.stringify([playerCard2, newCard2]),
            wager: activePlayerHand.wager,
          },
        });
      }

      socket.emit('gameState', await getGameState(roundId));
      console.log('gameState sent after action:', await getGameState(roundId));
    });

    socket.on('endRound', async (data) => {
      console.log('endRound received:', data);
      const { roundId } = data;
      const gameState = await getGameState(roundId);
      socket.emit('roundRecap', gameState);
      console.log('roundRecap sent:', gameState);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });
};

const createNewHand = async (roundId: number, shoe: Card[], wager: number) => {
  let { card: playerCard1, remainingShoe: shoeAfterPlayerCard1 } = drawCard(shoe);
  let { card: playerCard2, remainingShoe: shoeAfterPlayerCard2 } = drawCard(shoeAfterPlayerCard1);
  let { card: dealerCard1, remainingShoe: shoeAfterDealerCard1 } = drawCard(shoeAfterPlayerCard2);
  let { card: dealerCard2, remainingShoe: shoeAfterDealerCard2 } = drawCard(shoeAfterDealerCard1);

  const playerHand = [playerCard1, playerCard2];
  const dealerHand = [dealerCard1, dealerCard2];

  const hand = await prisma.hand.create({
    data: {
      roundId,
      isActive: true,
    },
  });

  const playerCardGroup = await prisma.playerHand.create({
    data: {
      handId: hand.id,
      cards: JSON.stringify(playerHand),
      wager,
    },
  });

  const dealerCardGroup = await prisma.dealerHand.create({
    data: {
      handId: hand.id,
      cards: JSON.stringify(dealerHand),
    },
  });

  await prisma.round.update({
    where: { id: roundId },
    data: { shoe: JSON.stringify(shoeAfterDealerCard2) },
  });

  console.log('createNewHand:', { playerHand, dealerHand });

  return {
    newHand: hand,
    playerCardGroups: [playerCardGroup],
    dealerCardGroup,
  };
}
