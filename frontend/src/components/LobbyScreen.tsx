import React from 'react';
import { type GameState } from '../hooks/useGameWebSocket';

interface LobbyScreenProps {
    gameState: GameState;
    myPlayerId: string;
    onAssignTeam: (playerId: string, team: number) => void;
    onStartGame: () => void;
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({ gameState, myPlayerId, onAssignTeam, onStartGame }) => {
    const isHost = gameState.HostID === myPlayerId;
    const isFull = gameState.Players.length === 4;

    return (
        <div className="w-full h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
            <div className="bg-slate-800 p-8 rounded-xl shadow-2xl max-w-2xl w-full border border-slate-700">
                <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                    <h1 className="text-3xl font-bold text-emerald-400">Game Lobby</h1>
                    <span className="bg-slate-700 px-3 py-1 rounded text-sm font-semibold">
                        {gameState.Players.length} / 4 Players
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    {gameState.Players.map((player) => (
                        <div key={player.ID} className={`p-4 rounded-lg flex items-center justify-between border ${player.ID === myPlayerId ? 'border-emerald-500 bg-emerald-900/20' : 'border-slate-600 bg-slate-900/50'}`}>
                            <div className="flex flex-col">
                                <span className={`font-bold text-lg flex items-center gap-2 ${player.Team === 1 ? 'text-blue-400' : 'text-red-400'}`}>
                                    {player.Name} 
                                    {player.ID === gameState.HostID && <span className="text-xs bg-yellow-600/80 text-yellow-100 px-2 py-0.5 rounded uppercase">Host</span>}
                                    {player.ID === myPlayerId && <span className="text-xs text-slate-400">(You)</span>}
                                </span>
                            </div>
                            
                            {isHost ? (
                                <select 
                                    value={player.Team} 
                                    onChange={(e) => onAssignTeam(player.ID, parseInt(e.target.value))}
                                    className={`text-white border border-slate-600 rounded p-1 text-sm outline-none cursor-pointer hover:opacity-80 ${player.Team === 1 ? 'bg-blue-600' : 'bg-red-600'}`}
                                >
                                    <option value={1} className="bg-slate-800 text-white">Team A</option>
                                    <option value={2} className="bg-slate-800 text-white">Team B</option>
                                </select>
                            ) : (
                                <span className={`px-2 py-1 rounded text-sm font-semibold ${player.Team === 1 ? 'bg-blue-600 text-white shadow-lg' : 'bg-red-600 text-white shadow-lg'}`}>
                                    Team {player.Team === 1 ? 'A' : 'B'}
                                </span>
                            )}
                        </div>
                    ))}
                    
                    {Array.from({ length: 4 - gameState.Players.length }).map((_, i) => (
                        <div key={`empty-${i}`} className="p-4 rounded-lg flex items-center justify-center border border-dashed border-slate-600 bg-slate-900/20 text-slate-500 italic">
                            Waiting for player...
                        </div>
                    ))}
                </div>

                {isHost ? (
                    <button
                        onClick={onStartGame}
                        disabled={!isFull}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 px-4 rounded-lg transition-colors shadow-lg text-lg"
                    >
                        {isFull ? 'Start Game' : 'Waiting for 4 players...'}
                    </button>
                ) : (
                    <div className="text-center text-slate-400 p-4 border border-slate-700 rounded-lg bg-slate-900/50">
                        Waiting for Host to start the game...
                    </div>
                )}
            </div>
        </div>
    );
};

export default LobbyScreen;
