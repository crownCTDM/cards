import React, { useState } from 'react';
import Card, { type Suit, type Rank } from './Card';

interface HandProps {
    cards: { suit: Suit; rank: Rank; originalIndex?: number }[];
    onCardClick?: (index: number) => void;
    hidden?: boolean;
}

const Hand: React.FC<HandProps> = ({ cards, onCardClick, hidden = false }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);

    // Hidden hands (opponents) are tightly clubbed in a single row.
    // Local player hand is clubbed on mobile until clicked.
    // In portrait mobile: expands into a wrapping grid (flex-wrap).
    // In landscape mobile: expands horizontally (-space-x-4).
    // On desktop (sm:): always normal row (-space-x-8), clicking does nothing visually.
    const containerClasses = hidden 
        ? 'flex justify-center -space-x-12 sm:-space-x-14' 
        : (isExpanded 
            ? 'flex justify-center portrait:flex-wrap portrait:gap-3 portrait:space-x-0 landscape:-space-x-3 sm:flex-nowrap sm:-space-x-8 sm:gap-0' 
            : 'flex justify-center -space-x-12 sm:-space-x-8');

    return (
        <div 
            className={`p-2 pt-6 sm:p-4 sm:pt-8 transition-all duration-300 max-w-full pb-4 scrollbar-hide ${containerClasses}`}
            onClick={() => {
                // Only toggle on mobile (innerWidth < 640px roughly)
                if (!hidden && window.innerWidth < 640) {
                    setIsExpanded(!isExpanded);
                    setActiveCardIndex(null); // Clear selection if toggling
                }
            }}
        >
            {cards.map((card, idx) => {
                const isMobileActive = activeCardIndex === idx;
                const actualIndex = card.originalIndex !== undefined ? card.originalIndex : idx;

                return (
                    <div key={idx} className={`relative group ${!hidden ? 'cursor-pointer hover:z-20' : ''}`}>
                        <div className={`transition-transform duration-200 ${!hidden ? 'sm:group-hover:-translate-y-4' : ''} ${isMobileActive ? '-translate-y-6 sm:-translate-y-0' : ''}`}>
                            <Card
                                suit={card.suit}
                                rank={card.rank}
                                onClick={(e) => {
                                    if (!hidden && onCardClick) {
                                        if (window.innerWidth < 640) {
                                            if (isExpanded) {
                                                e.stopPropagation();
                                                if (activeCardIndex === idx) {
                                                    // Second tap: play the card
                                                    onCardClick(actualIndex);
                                                    setActiveCardIndex(null);
                                                } else {
                                                    // First tap: select the card
                                                    setActiveCardIndex(idx);
                                                }
                                            }
                                        } else {
                                            onCardClick(actualIndex);
                                        }
                                    }
                                }}
                                hidden={hidden}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default Hand;
