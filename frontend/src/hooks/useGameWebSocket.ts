import { useEffect, useRef, useState } from 'react';
import { type Suit, type Rank } from '../components/Card';

export interface Player {
    ID: string;
    Name: string;
    Hand: { suit: Suit; rank: Rank }[];
    Team: number;
}

export type Phase = 'Waiting' | 'TrumpSelection' | 'Playing' | 'GameOver';

export interface GameState {
    Players: Player[];
    Phase: Phase;
    TrumpSuit: Suit;
    TrumpCaller: number;
    Turn: number;
    CurrentTrick: {
        Cards: { suit: Suit; rank: Rank }[];
        Leader: number;
    };
    TeamAScore: number;
    TeamBScore: number;
}

export const useGameWebSocket = (url: string) => {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        ws.current = new WebSocket(url);

        ws.current.onopen = () => {
            console.log('Connected to WebSocket');
            // Auto-join for demo
            ws.current?.send(JSON.stringify({ type: 'join', name: 'Player' + Math.floor(Math.random() * 100) }));
        };

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // Assuming backend sends raw GameState directly for now
                // Or wrapped in type
                // For prototype, let's assume raw state if valid, or handle specific message types
                setGameState(data);
            } catch (e) {
                console.error('Error parsing message', e);
            }
        };

        ws.current.onclose = () => {
            console.log('Disconnected');
        };

        return () => {
            ws.current?.close();
        };
    }, [url]);

    const sendAction = (action: any) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(action));
        }
    };

    return { gameState, sendAction };
};
