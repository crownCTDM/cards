package game

import "errors"

type GamePhase string

const (
	PhaseWaiting        GamePhase = "Waiting"
	PhaseTrumpSelection GamePhase = "TrumpSelection"
	PhasePlaying        GamePhase = "Playing"
	PhaseGameOver       GamePhase = "GameOver"
)

type GameState struct {
	Players      []*Player
	Phase        GamePhase
	Deck         Deck
	TrumpSuit    Suit
	TrumpCaller  int // Index of player who calls trump
	Turn         int // Index of player whose turn it is
	Tricks       [13]Trick
	CurrentTrick Trick
	TrickIndex   int
	TeamAScore   int
	TeamBScore   int
}

type Trick struct {
	Cards  []Card
	Winner int // Player index
	Leader int // Player index
}

func NewGame() *GameState {
	// Fixed 4 players placeholder
	return &GameState{
		Players:    make([]*Player, 0, 4),
		Phase:      PhaseWaiting,
		TrickIndex: 0,
	}
}

func (g *GameState) AddPlayer(id, name string) error {
	if len(g.Players) >= 4 {
		return errors.New("game full")
	}
	team := TeamA
	if len(g.Players)%2 != 0 {
		team = TeamB
	}
	p := NewPlayer(id, name, team)
	g.Players = append(g.Players, p)

	if len(g.Players) == 4 {
		g.Start()
	}
	return nil
}

func (g *GameState) Start() {
	g.Deck = NewDeck()
	g.Deck.Shuffle()
	g.distributeCards(5)
	g.Phase = PhaseTrumpSelection
	g.TrumpCaller = 0 // Rotation logic needed later
	g.Turn = g.TrumpCaller
}

func (g *GameState) SetTrump(suit Suit) error {
	if g.Phase != PhaseTrumpSelection {
		return errors.New("not in trump selection phase")
	}
	g.TrumpSuit = suit
	// Deal remaining cards
	g.distributeCards(8) // 5 already dealt, 8 more = 13 total
	g.Phase = PhasePlaying
	// Leader for first trick is Trump Caller
	g.CurrentTrick = Trick{Leader: g.TrumpCaller, Cards: make([]Card, 0, 4)}
	g.Turn = g.TrumpCaller
	return nil
}

func (g *GameState) distributeCards(count int) {
	for _, p := range g.Players {
		cards, _ := g.Deck.Draw(count) // Ignoring error for now as we know deck size
		p.Hand = append(p.Hand, cards...)
	}
}

func (g *GameState) PlayCard(playerIndex int, cardIndex int) error {
	if g.Phase != PhasePlaying {
		return errors.New("not in playing phase")
	}
	if g.Turn != playerIndex {
		return errors.New("not your turn")
	}

	p := g.Players[playerIndex]
	if cardIndex < 0 || cardIndex >= len(p.Hand) {
		return errors.New("invalid card index")
	}

	card := p.Hand[cardIndex]

	// Validate Move
	if len(g.CurrentTrick.Cards) > 0 {
		leadSuit := g.CurrentTrick.Cards[0].Suit
		if card.Suit != leadSuit {
			// Check if player has lead suit
			hasLeadSuit := false
			for _, c := range p.Hand {
				if c.Suit == leadSuit {
					hasLeadSuit = true
					break
				}
			}
			if hasLeadSuit {
				return errors.New("must follow suit")
			}
		}
	}

	// Remove card from hand
	p.Hand = append(p.Hand[:cardIndex], p.Hand[cardIndex+1:]...)

	// Add to trick
	g.CurrentTrick.Cards = append(g.CurrentTrick.Cards, card)

	// Next turn
	g.Turn = (g.Turn + 1) % 4

	// Check if trick is complete
	if len(g.CurrentTrick.Cards) == 4 {
		g.evaluateTrick()
	}

	return nil
}

func (g *GameState) evaluateTrick() {
	highestRank := Rank(0)
	leadSuit := g.CurrentTrick.Cards[0].Suit
	trumpPlayed := false

	// Determine winner relative to leader
	// Cards in CurrentTrick are ordered by play order: Leader, Leader+1, ...

	bestCardIdx := 0

	for i, card := range g.CurrentTrick.Cards {
		isTrump := card.Suit == g.TrumpSuit
		isLead := card.Suit == leadSuit

		if isTrump {
			if !trumpPlayed {
				trumpPlayed = true
				highestRank = card.Rank
				bestCardIdx = i
			} else {
				if card.Rank > highestRank {
					highestRank = card.Rank
					bestCardIdx = i
				}
			}
		} else if !trumpPlayed && isLead {
			if card.Rank > highestRank {
				highestRank = card.Rank
				bestCardIdx = i
			}
		}
	}

	// Calculate absolute player index of winner
	winningPlayerOffset := bestCardIdx
	winnerAbsIndex := (g.CurrentTrick.Leader + winningPlayerOffset) % 4

	g.CurrentTrick.Winner = winnerAbsIndex

	// Update Score (Simplest: count tricks)
	winnerTeam := g.Players[winnerAbsIndex].Team
	if winnerTeam == TeamA {
		g.TeamAScore++
	} else {
		g.TeamBScore++
	}

	// Store trick
	g.Tricks[g.TrickIndex] = g.CurrentTrick
	g.TrickIndex++

	// Check Game Over
	if g.TrickIndex == 13 {
		g.Phase = PhaseGameOver
	} else {
		// Setup next trick
		g.CurrentTrick = Trick{
			Leader: winnerAbsIndex,
			Cards:  make([]Card, 0, 4),
		}
		g.Turn = winnerAbsIndex
	}
}
