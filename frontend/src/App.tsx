import React, { useState } from 'react';
import GameBoard from './components/GameBoard';
import LoginScreen from './components/LoginScreen';
import LobbyScreen from './components/LobbyScreen';
import { useGameWebSocket } from './hooks/useGameWebSocket';

const App: React.FC = () => {
  const [hasJoined, setHasJoined] = useState(false);
  // Automatically use wss:// and strip port 8080 if running on Ngrok or Cloud (HTTPS)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const port = window.location.protocol === 'https:' ? '' : ':8080';
  const wsUrl = `${protocol}//${window.location.hostname}${port}/ws`;
  
  const { gameState, sendAction, connectGame, myPlayerId } = useGameWebSocket(wsUrl);

  const handleJoin = (name: string) => {
    connectGame(name);
    setHasJoined(true);
  };

  const handleAssignTeam = (playerId: string, team: number) => {
    sendAction({ type: 'set_team', playerId, team });
  };

  const handleStartGame = () => {
    sendAction({ type: 'start_game' });
  };

  if (!hasJoined || !gameState) {
    return <LoginScreen onJoin={handleJoin} />;
  }

  if (gameState.Phase === 'Lobby') {
    return (
      <LobbyScreen 
        gameState={gameState} 
        myPlayerId={myPlayerId} 
        onAssignTeam={handleAssignTeam}
        onStartGame={handleStartGame}
      />
    );
  }

  return <GameBoard gameState={gameState} sendAction={sendAction} myPlayerId={myPlayerId} />;
};

export default App;
