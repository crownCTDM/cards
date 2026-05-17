package server

import (
	"cards/game"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Client struct {
	Hub  *Hub
	Conn *websocket.Conn
	Send chan []byte
}

type Hub struct {
	Clients            map[*Client]bool
	Broadcast          chan []byte
	Register           chan *Client
	Unregister         chan *Client
	Game               *game.GameState
	Timeout            chan TimeoutEvent
	EvaluateTrickEvent chan struct{}
}

type TimeoutEvent struct {
	TurnCounter int
	PlayerIndex int
}

func NewHub() *Hub {
	return &Hub{
		Broadcast:          make(chan []byte),
		Register:           make(chan *Client),
		Unregister:         make(chan *Client),
		Clients:            make(map[*Client]bool),
		Game:               game.NewGame(),
		Timeout:            make(chan TimeoutEvent),
		EvaluateTrickEvent: make(chan struct{}),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.Clients[client] = true
			// Send initial state
			h.broadcastState()
		case client := <-h.Unregister:
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				close(client.Send)
			}
		case message := <-h.Broadcast:
			for client := range h.Clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.Clients, client)
				}
			}
		case event := <-h.Timeout:
			if h.Game.Phase == game.PhasePlaying && h.Game.TurnCounter == event.TurnCounter {
				err := h.Game.AutoPlay(event.PlayerIndex)
				if err == nil {
					log.Println("Auto-played for player", event.PlayerIndex)
					h.broadcastState()

					if len(h.Game.CurrentTrick.Cards) == 4 {
						go func() {
							time.Sleep(1000 * time.Millisecond)
							h.EvaluateTrickEvent <- struct{}{}
						}()
					} else {
						// Trigger next timer only if trick isn't full (evaluate handles the next timer otherwise)
						tc := h.Game.TurnCounter
						turn := h.Game.Turn
						go func(counter, playerIdx int) {
							time.Sleep(1 * time.Second)
							h.Timeout <- TimeoutEvent{TurnCounter: counter, PlayerIndex: playerIdx}
						}(tc, turn)
					}
				}
			} else if (h.Game.Phase == game.PhasePenaltyVoteLoser || h.Game.Phase == game.PhasePenaltyVoteWinner || h.Game.Phase == game.PhasePenaltyReturnCard) && h.Game.TurnCounter == event.TurnCounter {
				// Auto advance phase if timeout occurs
				h.Game.AutoAdvancePhase()
				h.broadcastState()

				// Launch timer for the NEXT phase
				tc := h.Game.TurnCounter
				go func(counter int) {
					time.Sleep(60 * time.Second)
					h.Timeout <- TimeoutEvent{TurnCounter: counter, PlayerIndex: -1}
				}(tc)
			}
		case <-h.EvaluateTrickEvent:
			if len(h.Game.CurrentTrick.Cards) == 4 {
				h.Game.EvaluateTrick()
				h.broadcastState()

				// Trigger next timer
				if h.Game.Phase == game.PhasePlaying {
					tc := h.Game.TurnCounter
					turn := h.Game.Turn
					go func(counter, playerIdx int) {
						time.Sleep(1 * time.Second)
						h.Timeout <- TimeoutEvent{TurnCounter: counter, PlayerIndex: playerIdx}
					}(tc, turn)
				}
			}
		}
	}
}

func (h *Hub) broadcastState() {
	stateJSON, err := json.Marshal(h.Game)
	if err != nil {
		log.Println("Error marshalling state:", err)
		return
	}
	for client := range h.Clients {
		client.Send <- stateJSON
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()
	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		// Handle message (Move logic here or invoke Hub method)
		log.Printf("recv: %s", message)

		var msg struct {
			Type        string `json:"type"`
			ID          string `json:"id"`
			Name        string `json:"name"`
			PlayerID    string `json:"playerId"`
			Team        int    `json:"team"`
			CardIndex   int    `json:"cardIndex"`
			Suit        string `json:"suit"`
			VoterIndex  int    `json:"voterIndex"`
			TargetIndex int    `json:"targetIndex"`
		}

		if err := json.Unmarshal(message, &msg); err != nil {
			log.Println("Invalid JSON:", err)
			continue
		}

		// Check if turn changed to trigger timer
		oldTurnCounter := c.Hub.Game.TurnCounter

		switch msg.Type {
		case "join":
			err := c.Hub.Game.AddPlayer(msg.ID, msg.Name)
			if err != nil {
				log.Println("Join error:", err)
			}
		case "set_team":
			err := c.Hub.Game.AssignTeam(msg.PlayerID, game.TeamID(msg.Team))
			if err != nil {
				log.Println("AssignTeam error:", err)
			}
		case "start_game":
			err := c.Hub.Game.Start()
			if err != nil {
				log.Println("Start error:", err)
			}
		case "set_trump":
			err := c.Hub.Game.SetTrump(game.Suit(msg.Suit))
			if err != nil {
				log.Println("SetTrump error:", err)
			}
		case "play":
			err := c.Hub.Game.PlayCard(c.Hub.Game.Turn, msg.CardIndex)
			if err != nil {
				log.Println("Play error:", err)
			} else {
				// Broadcast state immediately so the 4th card is visible
				c.Hub.broadcastState()

				if len(c.Hub.Game.CurrentTrick.Cards) == 4 {
					go func() {
						time.Sleep(1000 * time.Millisecond)
						c.Hub.EvaluateTrickEvent <- struct{}{}
					}()
				}
			}
		case "reset_game":
			err := c.Hub.Game.Reset()
			if err != nil {
				log.Println("Reset error:", err)
			}
		case "next_round":
			err := c.Hub.Game.NextRound()
			if err != nil {
				log.Println("NextRound error:", err)
			}
		case "vote_loser":
			err := c.Hub.Game.VoteLoser(msg.VoterIndex, msg.TargetIndex)
			if err != nil {
				log.Println("VoteLoser error:", err)
			}
		case "vote_winner":
			err := c.Hub.Game.VoteWinner(msg.VoterIndex, msg.TargetIndex)
			if err != nil {
				log.Println("VoteWinner error:", err)
			}
		case "return_card":
			err := c.Hub.Game.ReturnCard(msg.VoterIndex, msg.CardIndex)
			if err != nil {
				log.Println("ReturnCard error:", err)
			}
		}

		c.Hub.broadcastState()

		// If a valid move/change occurred during Playing phase, launch a timer
		if (c.Hub.Game.Phase == game.PhasePlaying || c.Hub.Game.Phase == game.PhasePenaltyVoteLoser || c.Hub.Game.Phase == game.PhasePenaltyVoteWinner || c.Hub.Game.Phase == game.PhasePenaltyReturnCard) && c.Hub.Game.TurnCounter > oldTurnCounter {
			tc := c.Hub.Game.TurnCounter
			turn := c.Hub.Game.Turn
			go func(counter, playerIdx int) {
				time.Sleep(1 * time.Second)
				c.Hub.Timeout <- TimeoutEvent{TurnCounter: counter, PlayerIndex: playerIdx}
			}(tc, turn)
		}
	}
}

func (c *Client) WritePump() {
	defer func() {
		c.Conn.Close()
	}()
	for message := range c.Send {
		w, err := c.Conn.NextWriter(websocket.TextMessage)
		if err != nil {
			return
		}
		w.Write(message)

		if err := w.Close(); err != nil {
			return
		}
	}
	c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
}

func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	client := &Client{Hub: hub, Conn: conn, Send: make(chan []byte, 256)}
	client.Hub.Register <- client

	go client.WritePump()
	go client.ReadPump()
}
