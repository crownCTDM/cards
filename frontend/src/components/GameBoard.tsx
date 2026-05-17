import React, { useState, useEffect, useRef } from 'react';
import Hand from './Hand';
import Card from './Card';
import { type GameState } from '../hooks/useGameWebSocket';

interface GameBoardProps {
    gameState: GameState;
    sendAction: (action: any) => void;
    myPlayerId: string;
}

const GameBoard: React.FC<GameBoardProps> = ({ gameState, sendAction, myPlayerId }) => {
    let myIdx = gameState.Players.findIndex(p => p.ID === myPlayerId);
    if (myIdx === -1) myIdx = 0; // Fallback for spectators

    const getPlayer = (relIdx: number) => {
        const absIdx = (myIdx + relIdx) % 4;
        return gameState.Players[absIdx] || { Name: 'Waiting...', Hand: [] };
    };

    const isTurn = (relIdx: number) => {
        const absIdx = (myIdx + relIdx) % 4;
        return gameState.Turn === absIdx;
    };

    const isHost = myPlayerId === gameState.HostID;

    const [isSorted, setIsSorted] = useState(false);

    const myPlayer = getPlayer(0);
    const displayHand = React.useMemo(() => {
        if (!myPlayer?.Hand) return [];
        if (!isSorted) return myPlayer.Hand.map((c, i) => ({ ...c, originalIndex: i }));

        return myPlayer.Hand.map((c, i) => ({ ...c, originalIndex: i }))
            .sort((a, b) => {
                if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
                return b.rank - a.rank;
            });
    }, [myPlayer?.Hand, isSorted]);

    // Visible Timer Logic
    const [timeLeft, setTimeLeft] = useState(1);
    const previousTurnCounter = useRef(gameState.TurnCounter);

    useEffect(() => {
        if (gameState.TurnCounter !== previousTurnCounter.current) {
            setTimeLeft(1);
            previousTurnCounter.current = gameState.TurnCounter;
        }
    }, [gameState.TurnCounter]);

    useEffect(() => {
        if (gameState.Phase !== 'Playing') return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [gameState.Phase, gameState.TurnCounter]);

    const handlePlay = (cardIndex: number, relIdx: number) => {
        if (relIdx === 0 && isTurn(0)) {
            sendAction({ type: 'play', cardIndex });
        }
    };

    const getCardPosition = (cardIdx: number): string => {
        if (!gameState.CurrentTrick) return "";
        const leader = gameState.CurrentTrick.Leader;
        const playerAbsIdx = (leader + cardIdx) % 4;
        const relIdx = (playerAbsIdx - myIdx + 4) % 4;

        const positions = [
            "translate-y-12",  // 0: Bottom
            "-translate-x-12", // 1: Left
            "-translate-y-12", // 2: Top
            "translate-x-12"   // 3: Right
        ];
        return positions[relIdx];
    };

    const getTrickWinner = () => {
        if (!gameState.CurrentTrick || !gameState.CurrentTrick.Cards || gameState.CurrentTrick.Cards.length < 4) return -1;
        let highestRank = -1;
        let leadSuit = gameState.CurrentTrick.Cards[0].suit;
        let trumpPlayed = false;
        let winnerTrickIdx = 0;

        gameState.CurrentTrick.Cards.forEach((card, idx) => {
            if (card.suit === gameState.TrumpSuit) {
                if (!trumpPlayed) {
                    trumpPlayed = true;
                    highestRank = card.rank;
                    winnerTrickIdx = idx;
                } else if (card.rank > highestRank) {
                    highestRank = card.rank;
                    winnerTrickIdx = idx;
                }
            } else if (!trumpPlayed && card.suit === leadSuit) {
                if (card.rank > highestRank) {
                    highestRank = card.rank;
                    winnerTrickIdx = idx;
                }
            }
        });
        return (gameState.CurrentTrick.Leader + winnerTrickIdx) % 4;
    };

    const getTrickAnimation = () => {
        if (!gameState.CurrentTrick || !gameState.CurrentTrick.Cards || gameState.CurrentTrick.Cards.length < 4) return '';
        const winnerAbsIdx = getTrickWinner();
        if (winnerAbsIdx === -1) return '';

        const relIdx = (winnerAbsIdx - myIdx + 4) % 4;
        const positions = [
            "translate-y-64 opacity-0 scale-50",
            "-translate-x-64 opacity-0 scale-50",
            "-translate-y-64 opacity-0 scale-50",
            "translate-x-64 opacity-0 scale-50"
        ];
        // 1s delay so they can see the trick, then 1.5s animation before backend clears (at 2.5s)
        return `transition-all duration-[1500ms] delay-1000 ${positions[relIdx]}`;
    };

    return (
        <div className="w-full h-screen min-h-[600px] bg-green-800 relative overflow-hidden flex flex-col items-center justify-center">
            {/* Timer Progress Bar */}
            {gameState.Phase === 'Playing' && (
                <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-800 z-50">
                    <div
                        className={`h-full transition-all duration-1000 ease-linear ${timeLeft < 15 ? 'bg-red-500' : 'bg-emerald-400'}`}
                        style={{ width: `${(timeLeft / 60) * 100}%` }}
                    />
                </div>
            )}

            {/* Board Center / Trick Area */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`w-64 h-64 bg-green-900/50 rounded-full flex items-center justify-center relative shadow-inner border border-green-700 pointer-events-auto ${getTrickAnimation()}`}>
                    {gameState.CurrentTrick && gameState.CurrentTrick.Cards && gameState.CurrentTrick.Cards.map((card, idx) => (
                        <div key={idx} className={`absolute transform ${getCardPosition(idx)} transition-all duration-300`}>
                            <Card suit={card.suit} rank={card.rank} className="scale-75 shadow-xl" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Trump Selection UI */}
            {gameState.Phase === 'TrumpSelection' && isHost && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-800 p-6 rounded-xl z-50 text-white shadow-2xl border border-slate-700 text-center w-11/12 max-w-sm">
                    <h2 className="text-xl sm:text-2xl font-bold mb-4">{gameState.Players[gameState.Turn]?.Name}, Select Trump</h2>
                    <div className="grid grid-cols-2 gap-4 justify-center">
                        {['Spades', 'Hearts', 'Diamonds', 'Clubs'].map(suit => (
                            <button key={suit} onClick={() => sendAction({ type: 'set_trump', suit })} className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white rounded-lg font-semibold text-lg shadow pointer-events-auto">
                                {suit}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {gameState.Phase === 'TrumpSelection' && !isHost && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/50 p-4 rounded-xl z-50 text-white shadow text-center">
                    Waiting for Host to select Trump...
                </div>
            )}

            {/* Game Over UI */}
            {gameState.Phase === 'GameOver' && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 p-8 rounded-2xl text-center text-white shadow-2xl border border-slate-700 max-w-md w-full">
                        <h2 className="text-4xl font-black mb-6 text-yellow-400">Game Over!</h2>

                        <div className="text-xl mb-4">
                            <p className="mb-2 text-blue-400">Team A: <span className="font-bold">{gameState.TeamAScore}</span> Tricks</p>
                            <p className="mb-6 text-red-400">Team B: <span className="font-bold">{gameState.TeamBScore}</span> Tricks</p>
                        </div>

                        <div className="text-2xl font-bold mb-8 py-4 bg-slate-900 rounded-lg">
                            {gameState.TeamAScore > gameState.TeamBScore ? 'Team A Wins!' :
                                gameState.TeamBScore > gameState.TeamAScore ? 'Team B Wins!' : 'It\'s a Tie!'}
                        </div>

                        {isHost ? (
                            <button
                                onClick={() => sendAction({ type: 'next_round' })}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 transition-colors rounded-xl font-bold text-xl shadow-lg pointer-events-auto"
                            >
                                Start Next Round
                            </button>
                        ) : (
                            <div className="text-slate-400 italic">
                                Waiting for Host to start next round...
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Penalty Vote Loser UI */}
            {gameState.Phase === 'PenaltyVoteLoser' && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 p-8 rounded-2xl text-center text-white shadow-2xl border border-slate-700 max-w-md w-full">
                        <h2 className="text-3xl font-black mb-4 text-red-400">Penalty Phase</h2>
                        <p className="mb-6 text-lg">The losing team must give up {gameState.TradeAmount} cards!</p>
                        <p className="text-sm text-slate-400 mb-6 font-bold uppercase tracking-widest border-b border-slate-700 pb-2">Trade {gameState.TradeIndex + 1} of {gameState.TradeAmount}</p>

                        {getPlayer(0).Team === gameState.LosingTeam ? (
                            <div className="flex flex-col gap-4 pointer-events-auto">
                                <p className="mb-2 text-yellow-300 font-semibold">Vote who gives away a card:</p>
                                {gameState.Players.map((p, idx) => p.Team === gameState.LosingTeam && (
                                    <button
                                        key={idx}
                                        onClick={() => sendAction({ type: 'vote_loser', voterIndex: myIdx, targetIndex: idx })}
                                        className={`w-full py-4 transition-colors rounded-xl font-bold text-xl shadow-lg border ${gameState.Votes && gameState.Votes[myIdx] === idx ? 'bg-red-600 border-red-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600'}`}
                                    >
                                        Vote {p.Name}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-slate-400 italic">Waiting for the losing team to vote...</div>
                        )}
                    </div>
                </div>
            )}

            {/* Penalty Vote Winner UI */}
            {gameState.Phase === 'PenaltyVoteWinner' && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 p-8 rounded-2xl text-center text-white shadow-2xl border border-slate-700 max-w-md w-full">
                        <h2 className="text-3xl font-black mb-4 text-emerald-400">Penalty Phase</h2>
                        <p className="mb-6 text-lg">{gameState.Players[gameState.TradeGiver].Name} gave up a card!</p>
                        <p className="text-sm text-slate-400 mb-6 font-bold uppercase tracking-widest border-b border-slate-700 pb-2">Trade {gameState.TradeIndex + 1} of {gameState.TradeAmount}</p>

                        {getPlayer(0).Team === gameState.WinningTeam ? (
                            <div className="flex flex-col gap-4 pointer-events-auto">
                                <p className="mb-2 text-yellow-300 font-semibold">Vote who receives it:</p>
                                {gameState.Players.map((p, idx) => p.Team === gameState.WinningTeam && (
                                    <button
                                        key={idx}
                                        onClick={() => sendAction({ type: 'vote_winner', voterIndex: myIdx, targetIndex: idx })}
                                        className={`w-full py-4 transition-colors rounded-xl font-bold text-xl shadow-lg border ${gameState.Votes && gameState.Votes[myIdx] === idx ? 'bg-emerald-600 border-emerald-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600'}`}
                                    >
                                        Vote {p.Name}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-slate-400 italic">Waiting for the winning team to vote...</div>
                        )}
                    </div>
                </div>
            )}

            {/* Penalty Return Card UI */}
            {gameState.Phase === 'PenaltyReturnCard' && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4 pointer-events-auto">
                    {myIdx === gameState.TradeReceiver ? (
                        <div className="text-center w-full max-w-3xl flex flex-col items-center">
                            <h2 className="text-4xl font-black mb-4 text-emerald-400 drop-shadow-md">You Received a Card!</h2>
                            <p className="mb-8 text-white text-xl">Select a card from your hand to give back to <span className="font-bold text-red-400">{gameState.Players[gameState.TradeGiver].Name}</span>.</p>
                            <div className="scale-125 origin-top mb-12">
                                <Hand cards={myPlayer?.Hand || []} hidden={false} onCardClick={(cardIdx) => sendAction({ type: 'return_card', voterIndex: myIdx, cardIndex: cardIdx })} />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-800 p-8 rounded-2xl text-center text-white shadow-2xl border border-slate-700 max-w-md w-full">
                            <h2 className="text-2xl font-black mb-4 text-emerald-400">Returning Card...</h2>
                            <p className="text-slate-300">Waiting for {gameState.Players[gameState.TradeReceiver].Name} to pick a card to return to {gameState.Players[gameState.TradeGiver].Name}.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Stats / Info */}
            <div className="absolute top-4 left-4 text-white bg-black/50 p-4 rounded text-sm pointer-events-none">
                <p>Phase: {gameState.Phase}</p>
                <p>Trump: {gameState.TrumpSuit || 'None'}</p>
                <p>Turn: {gameState.Players[gameState.Turn]?.Name}</p>
                <p><span className="text-blue-400 font-bold">Team A</span>: {gameState.TeamAScore} - <span className="text-red-400 font-bold">Team B</span>: {gameState.TeamBScore}</p>
            </div>

            {/* Player 2 (Top) */}
            <div className="absolute top-4 sm:top-8 w-full flex flex-col items-center pointer-events-none">
                <div className={`text-center mb-1 font-bold text-xs sm:text-base px-3 py-1 rounded-full ${getPlayer(2).Team === 1 ? 'bg-blue-900/80 text-blue-300 border border-blue-500/50' : 'bg-red-900/80 text-red-300 border border-red-500/50'} ${isTurn(2) ? 'ring-2 ring-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : ''}`}>
                    {getPlayer(2).Name}
                </div>
                <div className="transform rotate-180 origin-center scale-[0.4] sm:scale-75 pointer-events-auto">
                    <Hand cards={getPlayer(2).Hand} hidden={true} onCardClick={() => { }} />
                </div>
            </div>

            {/* Player 1 (Left) */}
            <div className="absolute left-[-2rem] sm:left-4 top-0 bottom-0 flex items-center justify-center pointer-events-none">
                <div className="-rotate-90 origin-center scale-[0.4] sm:scale-75 pointer-events-auto flex flex-col items-center">
                    <div className={`text-center mb-1 font-bold text-xs sm:text-base px-3 py-1 rounded-full ${getPlayer(1).Team === 1 ? 'bg-blue-900/80 text-blue-300 border border-blue-500/50' : 'bg-red-900/80 text-red-300 border border-red-500/50'} ${isTurn(1) ? 'ring-2 ring-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : ''}`}>
                        {getPlayer(1).Name}
                    </div>
                    <Hand cards={getPlayer(1).Hand} hidden={true} onCardClick={() => { }} />
                </div>
            </div>

            {/* Player 3 (Right) */}
            <div className="absolute right-[-2rem] sm:right-4 top-0 bottom-0 flex items-center justify-center pointer-events-none">
                <div className="rotate-90 origin-center scale-[0.4] sm:scale-75 pointer-events-auto flex flex-col items-center">
                    <div className={`text-center mb-1 font-bold text-xs sm:text-base px-3 py-1 rounded-full ${getPlayer(3).Team === 1 ? 'bg-blue-900/80 text-blue-300 border border-blue-500/50' : 'bg-red-900/80 text-red-300 border border-red-500/50'} ${isTurn(3) ? 'ring-2 ring-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : ''}`}>
                        {getPlayer(3).Name}
                    </div>
                    <Hand cards={getPlayer(3).Hand} hidden={true} onCardClick={() => { }} />
                </div>
            </div>

            {/* Player 0 (Bottom - YOU) */}
            <div className="absolute bottom-6 sm:bottom-4 w-full flex flex-col items-center pointer-events-none">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <div className={`text-center font-bold text-sm sm:text-base px-4 py-1 rounded-full ${getPlayer(0).Team === 1 ? 'bg-blue-900/90 text-blue-300 border border-blue-500/50' : 'bg-red-900/90 text-red-300 border border-red-500/50'} ${isTurn(0) ? 'ring-2 ring-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : ''}`}>
                        {getPlayer(0).Name} {isTurn(0) && gameState.Phase === 'Playing' && <span className="text-yellow-300 ml-1">({timeLeft}s)</span>}
                    </div>
                    {gameState.Phase === 'Playing' && (
                        <button
                            onClick={() => setIsSorted(!isSorted)}
                            className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded-full text-white font-semibold pointer-events-auto shadow-lg border border-slate-600 transition-colors"
                        >
                            {isSorted ? 'Unsort' : 'Sort Hand'}
                        </button>
                    )}
                </div>
                <div className="scale-100 sm:scale-110 origin-bottom pointer-events-auto">
                    <Hand cards={displayHand} hidden={false} onCardClick={(idx) => handlePlay(idx, 0)} />
                </div>
            </div>

        </div>
    );
};

export default GameBoard;
