import React from 'react';

export type Suit = 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

interface CardProps {
    suit: Suit;
    rank: Rank;
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    className?: string; // Allow custom styling
    hidden?: boolean;
}

const suitSymbols: Record<Suit, string> = {
    Spades: '♠',
    Hearts: '♥',
    Diamonds: '♦',
    Clubs: '♣',
};

const rankLabels: Record<number, string> = {
    11: 'J',
    12: 'Q',
    13: 'K',
    14: 'A',
};

const Card: React.FC<CardProps> = ({ suit, rank, onClick, className = '', hidden = false }) => {
    if (hidden) {
        return (
            <div className={`w-16 h-24 sm:w-20 sm:h-32 bg-blue-900 rounded-lg shadow-md border-2 border-slate-300 flex items-center justify-center bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#1e3a8a_10px,#1e3a8a_20px)] ${className}`}>
                <div className="w-12 h-20 sm:w-16 sm:h-28 border border-blue-400 rounded opacity-30"></div>
            </div>
        );
    }

    const isRed = suit === 'Hearts' || suit === 'Diamonds';
    const label = rankLabels[rank] || rank.toString();

    return (
        <div
            onClick={onClick}
            className={`
        relative w-16 h-24 sm:w-20 sm:h-32 bg-white rounded-lg shadow-md border border-gray-200 
        flex flex-col justify-between p-1 sm:p-2 select-none 
        ${onClick ? 'cursor-pointer' : ''}
        ${isRed ? 'text-red-600' : 'text-slate-900'}
        ${className}
      `}
        >
            <div className="text-base sm:text-lg font-bold font-serif leading-none">
                {label}
                <div className="text-xs">{suitSymbols[suit]}</div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl">
                {suitSymbols[suit]}
            </div>

            <div className="text-base sm:text-lg font-bold font-serif leading-none transform rotate-180 self-end text-right">
                {label}
                <div className="text-xs">{suitSymbols[suit]}</div>
            </div>
        </div>
    );
};

export default Card;

