import React from 'react';
import Hand from './Hand';
import Card from './Card';
import { useGameWebSocket } from '../hooks/useGameWebSocket';

const GameBoard: React.FC = () => {
    const { gameState, sendAction } = useGameWebSocket('ws://localhost:8080/ws');

    if (!gameState) {
        return <div className="flex items-center justify-center h-screen text-white">Connecting...</div>;
    }

    // Identify "Me" (client-side ID logic needed, for now just show all hands or perspective 0)
    // For hotseat demo, we might show all hands or toggle?
    // Let's visualize the board as a spectator/hot-seat for now.
    // 4 Players arranged: Bottom (0), Left (1), Top (2), Right (3)

    const getPlayer = (idx: number) => gameState.Players[idx] || { Name: 'Waiting...', Hand: [] };

    return (
        <div className="w-full h-screen bg-green-800 relative overflow-hidden flex flex-col items-center justify-center">
            {/* Board Center / Trick Area */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 bg-green-900/50 rounded-full flex items-center justify-center relative">
                    {gameState.CurrentTrick && gameState.CurrentTrick.Cards && gameState.CurrentTrick.Cards.map((card, idx) => (
                        <div key={idx} className={`absolute transform ${getCardPosition(idx)}`}>
                            <Card suit={card.suit} rank={card.rank} className="scale-75" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Stats / Info */}
            <div className="absolute top-4 left-4 text-white bg-black/50 p-4 rounded text-sm">
                <p>Phase: {gameState.Phase}</p>
                <p>Trump: {gameState.TrumpSuit || 'None'}</p>
                <p>Turn: {gameState.Players[gameState.Turn]?.Name}</p>
                <p>Team A: {gameState.TeamAScore} - Team B: {gameState.TeamBScore}</p>
            </div>

            {/* Player 2 (Top) */}
            <div className="absolute top-4">
                <div className="text-white text-center mb-2">{getPlayer(2).Name}</div>
                <div className="transform rotate-180">
                    <Hand cards={getPlayer(2).Hand} />
                </div>
            </div>

            {/* Player 1 (Left) */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 -translate-x-1/2 -rotate-90 origin-center">
                <div className="text-white text-center mb-2">{getPlayer(1).Name}</div>
                <Hand cards={getPlayer(1).Hand} />
            </div>

            {/* Player 3 (Right) */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 translate-x-1/2 rotate-90 origin-center">
                <div className="text-white text-center mb-2">{getPlayer(3).Name}</div>
                <Hand cards={getPlayer(3).Hand} />
            </div>

            {/* Player 0 (Bottom - You) */}
            <div className="absolute bottom-4">
                <div className="text-white text-center mb-2">{getPlayer(0).Name} (You)</div>
                <Hand cards={getPlayer(0).Hand} onCardClick={(idx) => {
                    // Send Play Card Action
                    sendAction({ type: 'play', cardIndex: idx });
                }} />
            </div>

        </div>
    );
};

// Helper for positioning cards in trick
function getCardPosition(cardIdx: number): string {
    // Determine relative "seat" of the card
    // 0=Bottom, 1=Left, 2=Top, 3=Right
    // Simple mock logic for visualization
    const positions = [
        "translate-y-12",
        "-translate-x-12",
        "-translate-y-12",
        "translate-x-12"
    ];
    return positions[cardIdx % 4]; // Simplified
}

export default GameBoard;
