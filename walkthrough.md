# Court Piece Game Walkthrough

We have successfully implemented the core structure of the Court Piece card game.

## Key Components

### Backend (Go)
- **Engine ([backend/game/engine.go](file:///c:/Users/lolep/githubPersonal/cards/backend/game/engine.go))**: Manages the game state, including specialized logic for:
    - `Waiting`, `TrumpSelection`, `Playing` phases.
    - Card dealing and shuffling.
    - Tricks evaluation and scoring.
- **WebSocket Server ([backend/server/server.go](file:///c:/Users/lolep/githubPersonal/cards/backend/server/server.go))**:
    - Handles real-time connections.
    - Broadcasts game state updates to all clients.
    - Processes player actions (`join`, `play`).

### Frontend (React + Vite + Tailwind)
- **Game Board ([frontend/src/components/GameBoard.tsx](file:///c:/Users/lolep/githubPersonal/cards/frontend/src/components/GameBoard.tsx))**:
    - Visualizes the 4-player table.
    - Shows the current trick in the center.
    - Displays hands for all players (simulated view).
- **Cards ([frontend/src/components/Card.tsx](file:///c:/Users/lolep/githubPersonal/cards/frontend/src/components/Card.tsx))**:
    - Beautifully styled CSS-only card components.
- **Real-time Updates**:
    - Uses [useGameWebSocket](file:///c:/Users/lolep/githubPersonal/cards/frontend/src/hooks/useGameWebSocket.ts#27-69) hook to stay in sync with the server.

## How to Run

1. **Start Backend**:
   ```bash
   cd backend
   go run main.go
   ```
   Server runs on `localhost:8080`.

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

## Next Steps
- Implement full multiplayer identity (so you only see your own hand).
- Add UI for selecting trump suit.
- Polish the "Game Over" screen.
