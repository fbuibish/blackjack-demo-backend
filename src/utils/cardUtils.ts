// src/utils/cardUtils.ts

export type Suit = 'Heart' | 'Diamond' | 'Club' | 'Spade';
export type Value = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  value: Value;
  suit: Suit;
}

// Function to create a single deck of cards
export function createDeck(): Card[] {
  const suits: Suit[] = ['Heart', 'Diamond', 'Club', 'Spade'];
  const values: Value[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const value of values) {
      deck.push({ value, suit });
    }
  }

  return deck;
}

// Function to create a shoe (6 decks)
export function createShoe(): Card[] {
  const shoe: Card[] = [];
  
  for (let i = 0; i < 6; i++) {
    shoe.push(...createDeck());
  }

  return shoe;
}

// Function to shuffle the shoe
export function shuffleShoe(shoe: Card[]): Card[] {
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }

  return shoe;
}

// Function to initialize and shuffle a 6-deck shoe
export function initializeShoe(): Card[] {
  const shoe = createShoe();
  return shuffleShoe(shoe);
}

// Function to draw a card from the shoe
export function drawCard(shoe: Card[]): { card: Card, remainingShoe: Card[] } {
  const card = shoe[0];
  const remainingShoe = shoe.slice(1);
  return { card, remainingShoe };
}

// Function to calculate the hand value
export function calculateHandValue(hand: Card[]): number {
  let total = 0;
  let aceCount = 0;

  hand.forEach(card => {
    if (card.value > 10) {
      total += 10;
    } else if (card.value === 1) {
      total += 11;
      aceCount++;
    } else {
      total += card.value;
    }
  });

  while (total > 21 && aceCount > 0) {
    total -= 10;
    aceCount--;
  }

  return total;
}
