import { useEffect, useRef, useState } from 'react';
import { type Suit, type Rank } from '../components/Card';

export interface Player {
    ID: string;
    Name: string;
    Hand: { suit: Suit; rank: Rank }[];
    Team: number;
}

export type Phase = 'Lobby' | 'TrumpSelection' | 'Playing' | 'GameOver' | 'PenaltyVoteLoser' | 'PenaltyVoteWinner' | 'PenaltyReturnCard';

export interface GameState {
    Players: Player[];
    Phase: Phase;
    HostID: string;
    TrumpSuit: Suit;
    TrumpCaller: number;
    Turn: number;
    TurnCounter: number;
    CurrentTrick: {
        Cards: { suit: Suit; rank: Rank }[];
        Leader: number;
    };
    TeamAScore: number;
    TeamBScore: number;
    
    // Advanced Mechanics State
    RoundsPlayed: number;
    TradeAmount: number;
    TradeIndex: number;
    LosingTeam: number;
    WinningTeam: number;
    Votes: { [voterIdx: number]: number };
    TradeGiver: number;
    TradeReceiver: number;
}

export const useGameWebSocket = (url: string) => {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [myPlayerId, setMyPlayerId] = useState<string>('');
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        // Generate or retrieve a persistent session ID for reconnection
        let savedId = localStorage.getItem('playerId');
        if (!savedId) {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                savedId = crypto.randomUUID();
            } else {
                // Fallback for HTTP network IPs where crypto.randomUUID is disabled
                savedId = 'user_' + Math.random().toString(36).substring(2, 15);
            }
            localStorage.setItem('playerId', savedId);
        }
        setMyPlayerId(savedId);

        ws.current = new WebSocket(url);

        ws.current.onopen = () => {
            console.log('Connected to WebSocket');
            // No auto-join, must call connectGame explicitly
        };

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setGameState(data);
            } catch (e) {
                console.error('Error parsing message', e);
            }
        };

        ws.current.onclose = () => {
            console.log('Disconnected from WebSocket');
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

    const connectGame = (name: string) => {
        sendAction({ type: 'join', id: myPlayerId, name });
    };

    return { gameState, sendAction, connectGame, myPlayerId };
};
