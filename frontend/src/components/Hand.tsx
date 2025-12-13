import React from 'react';
import Card, { type Suit, type Rank } from './Card';

interface HandProps {
    cards: { suit: Suit; rank: Rank }[];
    onCardClick?: (index: number) => void;
}

const Hand: React.FC<HandProps> = ({ cards, onCardClick }) => {
    return (
        <div className="flex -space-x-12 hover:space-x-2 transition-all p-4 justify-center">
            {cards.map((card, idx) => (
                <div key={idx} className="relative transition-transform hover:z-10 hover:scale-105">
                    <Card
                        suit={card.suit}
                        rank={card.rank}
                        onClick={() => onCardClick && onCardClick(idx)}
                    />
                </div>
            ))}
        </div>
    );
};

export default Hand;
