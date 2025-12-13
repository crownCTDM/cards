package server

import (
	"cards/game"
	"encoding/json"
	"log"
	"net/http"

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
	Clients    map[*Client]bool
	Broadcast  chan []byte
	Register   chan *Client
	Unregister chan *Client
	Game       *game.GameState
}

func NewHub() *Hub {
	return &Hub{
		Broadcast:  make(chan []byte),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Clients:    make(map[*Client]bool),
		Game:       game.NewGame(),
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
			Type      string `json:"type"`
			Name      string `json:"name"`
			CardIndex int    `json:"cardIndex"`
			Suit      string `json:"suit"`
		}

		if err := json.Unmarshal(message, &msg); err != nil {
			log.Println("Invalid JSON:", err)
			continue
		}

		switch msg.Type {
		case "join":
			// Simple join logic - add player
			// In real app, associate Client with Player
			err := c.Hub.Game.AddPlayer("uuid-placeholder", msg.Name)
			if err != nil {
				log.Println("Join error:", err)
			}
		case "play":
			// Need to know which player this client is
			// For prototype, assuming single player controlling all or 1:1 mapping if possible
			// Let's assume Turn based play
			err := c.Hub.Game.PlayCard(c.Hub.Game.Turn, msg.CardIndex)
			if err != nil {
				log.Println("Play error:", err)
			}
		}

		c.Hub.broadcastState()
	}
}

func (c *Client) WritePump() {
	defer func() {
		c.Conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}
		}
	}
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
