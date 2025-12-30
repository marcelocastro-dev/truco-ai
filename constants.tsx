
import React from 'react';
import { Rank, Suit } from './types';

export const RANKS: Rank[] = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
export const SUITS: Suit[] = ['Diamonds', 'Spades', 'Hearts', 'Clubs'];

// Card Power mapping (Weakest to Strongest)
export const RANK_POWER: Record<Rank, number> = {
  '4': 1,
  '5': 2,
  '6': 3,
  '7': 4,
  'Q': 5,
  'J': 6,
  'K': 7,
  'A': 8,
  '2': 9,
  '3': 10,
};

// Suit power specifically for Manilhas (Zap, Copas, Espilha, Ouros)
export const MANILHA_SUIT_POWER: Record<Suit, number> = {
  'Diamonds': 1,
  'Spades': 2,
  'Hearts': 3,
  'Clubs': 4,
};

export const NEXT_RANK: Record<Rank, Rank> = {
  '4': '5',
  '5': '6',
  '6': '7',
  '7': 'Q',
  'Q': 'J',
  'J': 'K',
  'K': 'A',
  'A': '2',
  '2': '3',
  '3': '4',
};

export const getSuitIcon = (suit: Suit) => {
  switch (suit) {
    case 'Clubs': return <i className="fa-solid fa-clover text-green-800"></i>;
    case 'Hearts': return <i className="fa-solid fa-heart text-red-600"></i>;
    case 'Spades': return <i className="fa-solid fa-spade text-slate-900"></i>;
    case 'Diamonds': return <i className="fa-solid fa-diamond text-red-600"></i>;
  }
};

export const getSuitColor = (suit: Suit) => {
  switch (suit) {
    case 'Hearts':
    case 'Diamonds': return 'text-red-600';
    default: return 'text-slate-900';
  }
};
