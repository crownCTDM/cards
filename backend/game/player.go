package game

import "fmt"

type TeamID int

const (
	TeamA TeamID = 1
	TeamB TeamID = 2
)

type Player struct {
	ID   string
	Name string
	Hand Deck // Using Deck type which is []Card
	Team TeamID
}

func NewPlayer(id, name string, team TeamID) *Player {
	return &Player{
		ID:   id,
		Name: name,
		Team: team,
		Hand: make(Deck, 0),
	}
}

func (p *Player) String() string {
	return fmt.Sprintf("%s (Team %d): %d cards", p.Name, p.Team, len(p.Hand))
}
