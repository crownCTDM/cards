import React from 'react';

// Shared types (should ideally be in a shared types file)
export type Suit = 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

interface CardProps {
    suit: Suit;
    rank: Rank;
    onClick?: () => void;
    className?: string; // Allow custom styling
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

const Card: React.FC<CardProps> = ({ suit, rank, onClick, className = '' }) => {
    const isRed = suit === 'Hearts' || suit === 'Diamonds';
    const label = rankLabels[rank] || rank.toString();

    return (
        <div
            onClick={onClick}
            className={`
        relative w-24 h-36 bg-white rounded-lg shadow-md border border-gray-200 
        flex flex-col justify-between p-2 select-none cursor-pointer hover:-translate-y-2 transition-transform
        ${isRed ? 'text-red-600' : 'text-slate-900'}
        ${className}
      `}
        >
            <div className="text-xl font-bold font-serif leading-none">
                {label}
                <div className="text-sm">{suitSymbols[suit]}</div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center text-4xl">
                {suitSymbols[suit]}
            </div>

            <div className="text-xl font-bold font-serif leading-none transform rotate-180 self-end text-right">
                {label}
                <div className="text-sm">{suitSymbols[suit]}</div>
            </div>
        </div>
    );
};

export default Card;
