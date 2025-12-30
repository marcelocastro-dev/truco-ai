
export type Suit = 'Clubs' | 'Hearts' | 'Spades' | 'Diamonds';
export type Rank = '4' | '5' | '6' | '7' | 'Q' | 'J' | 'K' | 'A' | '2' | '3';

export interface Card {
  rank: Rank;
  suit: Suit;
  id: string;
}

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  isAI: boolean;
  team: number;
}

export interface PlayedCard {
  playerId: number;
  card: Card;
}

export type RoundStatus = 'best_of_3' | 'finished';
export type TrucoStatus = 1 | 3 | 6 | 9 | 12;

export type AppView = 'lobby' | 'rooms' | 'waiting' | 'game';

export interface Room {
  id: number;
  name: string;
  playersCount: number;
  capacity: number;
}

export interface GameState {
  players: Player[];
  deck: Card[];
  vira: Card | null;
  manilhaRank: Rank | null;
  currentTurn: number;
  playedCards: PlayedCard[];
  roundResults: number[];
  teamScores: [number, number];
  trucoValue: TrucoStatus;
  trucoChallenger: number | null;
  waitingForTrucoResponse: boolean;
  dealer: number;
  message: string;
  isGameOver: boolean;
}

export interface AIResponse {
  action: 'play' | 'truco' | 'accept' | 'refuse';
  cardIndex?: number;
  message?: string;
}
