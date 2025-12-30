
import React from 'react';
import { Card, Suit, Rank } from '../types';
import { getSuitIcon, getSuitColor } from '../constants';

interface CardUIProps {
  card?: Card;
  hidden?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  isManilha?: boolean;
  className?: string;
}

const CardUI: React.FC<CardUIProps> = ({ card, hidden, onClick, disabled, isManilha, className }) => {
  const baseClasses = `relative w-24 h-36 md:w-28 md:h-40 bg-white rounded-xl shadow-lg flex flex-col items-center justify-between p-2 border-2 transition-all duration-200 ${className}`;
  const interactiveClasses = !disabled && onClick ? 'cursor-pointer hover:-translate-y-4 hover:shadow-2xl border-transparent hover:border-yellow-400' : 'border-gray-200';
  
  if (hidden) {
    return (
      <div className={`${baseClasses} bg-blue-900 border-white`}>
        <div className="w-full h-full border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center">
          <div className="text-white text-3xl font-black opacity-20">TRUCO</div>
        </div>
      </div>
    );
  }

  if (!card) return <div className="w-24 h-36 border-2 border-dashed border-gray-400 rounded-xl"></div>;

  return (
    <div 
      onClick={!disabled ? onClick : undefined}
      className={`${baseClasses} ${interactiveClasses} ${disabled ? 'opacity-50 grayscale' : ''} ${isManilha ? 'ring-4 ring-yellow-400' : ''}`}
    >
      <div className="w-full flex justify-start items-start">
        <div className={`flex flex-col items-center leading-none ${getSuitColor(card.suit)}`}>
          <span className="text-lg font-bold">{card.rank}</span>
          <span className="text-sm">{getSuitIcon(card.suit)}</span>
        </div>
      </div>
      
      <div className={`text-4xl ${getSuitColor(card.suit)}`}>
        {getSuitIcon(card.suit)}
      </div>

      <div className="w-full flex justify-end items-end rotate-180">
        <div className={`flex flex-col items-center leading-none ${getSuitColor(card.suit)}`}>
          <span className="text-lg font-bold">{card.rank}</span>
          <span className="text-sm">{getSuitIcon(card.suit)}</span>
        </div>
      </div>

      {isManilha && (
        <div className="absolute -top-2 -right-2 bg-yellow-400 text-xs font-bold px-1 rounded shadow">
          M
        </div>
      )}
    </div>
  );
};

export default CardUI;
