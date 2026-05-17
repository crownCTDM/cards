package game

import "errors"

type GamePhase string

const (
	PhaseLobby             GamePhase = "Lobby"
	PhaseTrumpSelection    GamePhase = "TrumpSelection"
	PhasePlaying           GamePhase = "Playing"
	PhaseGameOver          GamePhase = "GameOver"
	PhasePenaltyVoteLoser  GamePhase = "PenaltyVoteLoser"
	PhasePenaltyVoteWinner GamePhase = "PenaltyVoteWinner"
	PhasePenaltyReturnCard GamePhase = "PenaltyReturnCard"
)

type GameState struct {
	Players      []*Player
	Phase        GamePhase
	HostID       string
	Deck         Deck
	TrumpSuit    Suit
	TrumpCaller  int // Index of player who calls trump
	Turn         int // Index of player whose turn it is
	TurnCounter  int // Incremented on turn changes for timeouts
	Tricks       [13]Trick
	CurrentTrick Trick
	TrickIndex   int
	TeamAScore   int
	TeamBScore   int
	
	// Advanced Mechanics State
	RoundsPlayed  int
	TradeAmount   int
	TradeIndex    int
	LosingTeam    TeamID
	WinningTeam   TeamID
	Votes         map[int]int // VoterPlayerIdx -> VotedForPlayerIdx
	PendingCard   *Card
	TradeGiver    int
	TradeReceiver int
}

type Trick struct {
	Cards  []Card
	Winner int // Player index
	Leader int // Player index
}

func NewGame() *GameState {
	return &GameState{
		Players:    make([]*Player, 0, 4),
		Phase:      PhaseLobby,
		TrickIndex: 0,
		Votes:      make(map[int]int),
	}
}

func (g *GameState) AddPlayer(id, name string) error {
	if len(g.Players) >= 4 {
		return errors.New("game full")
	}
	
	// Check if player is reconnecting
	for _, p := range g.Players {
		if p.ID == id {
			p.Name = name // Update name
			return nil
		}
	}

	team := TeamA
	if len(g.Players)%2 != 0 {
		team = TeamB
	}
	p := NewPlayer(id, name, team)
	g.Players = append(g.Players, p)

	// First player is host
	if len(g.Players) == 1 {
		g.HostID = id
	}

	return nil
}

func (g *GameState) AssignTeam(playerID string, team TeamID) error {
	if g.Phase != PhaseLobby {
		return errors.New("can only assign teams in lobby")
	}
	for _, p := range g.Players {
		if p.ID == playerID {
			p.Team = team
			return nil
		}
	}
	return errors.New("player not found")
}

func (g *GameState) Start() error {
	if len(g.Players) < 4 {
		return errors.New("need 4 players to start")
	}
	if g.Phase != PhaseLobby {
		return errors.New("game already started")
	}

	// Enforce alternating seating (A, B, A, B) or (B, A, B, A)
	teamA := make([]*Player, 0)
	teamB := make([]*Player, 0)
	for _, p := range g.Players {
		if p.Team == TeamA {
			teamA = append(teamA, p)
		} else {
			teamB = append(teamB, p)
		}
	}
	if len(teamA) != 2 || len(teamB) != 2 {
		return errors.New("teams must be balanced (2v2)")
	}
	
	// Seat them alternating
	g.Players = []*Player{teamA[0], teamB[0], teamA[1], teamB[1]}

	g.Deck = NewDeck()
	g.Deck.Shuffle()
	g.distributeCards(5)
	g.Phase = PhaseTrumpSelection
	g.TrumpCaller = g.RoundsPlayed % 4 // Rotates clockwise (alternating teams)
	g.Turn = g.TrumpCaller
	g.TurnCounter++
	return nil
}

func (g *GameState) Reset() error {
	if g.Phase != PhaseGameOver {
		return errors.New("can only reset from game over")
	}
	g.Phase = PhaseLobby
	g.TeamAScore = 0
	g.TeamBScore = 0
	g.TrickIndex = 0
	g.Tricks = [13]Trick{}
	g.CurrentTrick = Trick{}
	g.Deck = nil
	for _, p := range g.Players {
		p.Hand = nil
	}
	g.Votes = make(map[int]int)
	g.PendingCard = nil
	g.TurnCounter++
	return nil
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
	g.TurnCounter++
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
	g.TurnCounter++

	// Note: evaluateTrick is now called explicitly by the server to allow delays
	return nil
}

func (g *GameState) EvaluateTrick() {
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
		callerTeam := g.Players[g.TrumpCaller].Team
		defenderTeam := TeamA
		if callerTeam == TeamA {
			defenderTeam = TeamB
		}

		callerTricks := g.TeamAScore
		if callerTeam == TeamB {
			callerTricks = g.TeamBScore
		}
		defenderTricks := 13 - callerTricks

		differential := 0
		if callerTricks >= 8 {
			differential = callerTricks - 6
			g.WinningTeam = callerTeam
			g.LosingTeam = defenderTeam
		} else if defenderTricks >= 7 {
			differential = defenderTricks - 6
			g.WinningTeam = defenderTeam
			g.LosingTeam = callerTeam
		}

		g.TradeAmount = differential
		g.TradeIndex = 0
		g.RoundsPlayed++
		g.Phase = PhaseGameOver
	} else {
		// Setup next trick
		g.CurrentTrick = Trick{
			Leader: winnerAbsIndex,
			Cards:  make([]Card, 0, 4),
		}
		g.Turn = winnerAbsIndex
		g.TurnCounter++
	}
}

func (g *GameState) AutoPlay(playerIndex int) error {
	if g.Phase != PhasePlaying || g.Turn != playerIndex {
		return errors.New("invalid auto-play state")
	}

	p := g.Players[playerIndex]
	if len(p.Hand) == 0 {
		return nil
	}

	validIndices := []int{}
	if len(g.CurrentTrick.Cards) > 0 {
		leadSuit := g.CurrentTrick.Cards[0].Suit
		hasLeadSuit := false
		for _, c := range p.Hand {
			if c.Suit == leadSuit {
				hasLeadSuit = true
				break
			}
		}

		for i, c := range p.Hand {
			if hasLeadSuit && c.Suit == leadSuit {
				validIndices = append(validIndices, i)
			} else if !hasLeadSuit {
				validIndices = append(validIndices, i)
			}
		}
	} else {
		for i := range p.Hand {
			validIndices = append(validIndices, i)
		}
	}

	// Pick first valid card
	if len(validIndices) > 0 {
		return g.PlayCard(playerIndex, validIndices[0])
	}
	return nil
}

func (g *GameState) NextRound() error {
	if g.Phase != PhaseGameOver {
		return errors.New("can only start next round from game over")
	}

	g.TeamAScore = 0
	g.TeamBScore = 0
	g.TrickIndex = 0
	g.Tricks = [13]Trick{}
	g.CurrentTrick = Trick{}
	for _, p := range g.Players {
		p.Hand = make([]Card, 0)
	}

	g.Deck = NewDeck()
	g.Deck.Shuffle()

	if g.TradeAmount > 0 {
		// Deal all 13 cards for the penalty trade phase
		g.distributeCards(13)
		g.Phase = PhasePenaltyVoteLoser
		g.Votes = make(map[int]int)
	} else {
		// Tie, normal start
		g.distributeCards(5)
		g.Phase = PhaseTrumpSelection
	}

	g.TrumpCaller = g.RoundsPlayed % 4
	g.Turn = g.TrumpCaller
	g.TurnCounter++
	return nil
}

func (g *GameState) VoteLoser(voterIndex int, targetIndex int) error {
	if g.Phase != PhasePenaltyVoteLoser { return errors.New("wrong phase") }
	if g.Players[voterIndex].Team != g.LosingTeam { return errors.New("only losing team can vote") }
	if g.Players[targetIndex].Team != g.LosingTeam { return errors.New("must vote for loser") }
	
	g.Votes[voterIndex] = targetIndex
	
	if len(g.Votes) == 2 {
		g.processLoserVotes()
	}
	return nil
}

func (g *GameState) processLoserVotes() {
	targetCounts := make(map[int]int)
	for _, v := range g.Votes {
		targetCounts[v]++
	}
	
	selected := -1
	for target, count := range targetCounts {
		if count == 2 {
			selected = target
		}
	}
	if selected == -1 {
		// Tie! Pick target of first vote
		for _, v := range g.Votes {
			selected = v
			break
		}
	}
	
	g.TradeGiver = selected
	
	// Pick random card
	hand := g.Players[selected].Hand
	if len(hand) > 0 {
		g.PendingCard = &hand[0]
		g.Players[selected].Hand = hand[1:]
	}
	
	g.Phase = PhasePenaltyVoteWinner
	g.Votes = make(map[int]int)
	g.TurnCounter++
}

func (g *GameState) VoteWinner(voterIndex int, targetIndex int) error {
	if g.Phase != PhasePenaltyVoteWinner { return errors.New("wrong phase") }
	if g.Players[voterIndex].Team != g.WinningTeam { return errors.New("only winning team can vote") }
	if g.Players[targetIndex].Team != g.WinningTeam { return errors.New("must vote for winner") }
	
	g.Votes[voterIndex] = targetIndex
	
	if len(g.Votes) == 2 {
		g.processWinnerVotes()
	}
	return nil
}

func (g *GameState) processWinnerVotes() {
	targetCounts := make(map[int]int)
	for _, v := range g.Votes {
		targetCounts[v]++
	}
	
	selected := -1
	for target, count := range targetCounts {
		if count == 2 {
			selected = target
		}
	}
	if selected == -1 {
		for _, v := range g.Votes {
			selected = v
			break
		}
	}
	
	g.TradeReceiver = selected
	// Give the pending card to the winner
	g.Players[selected].Hand = append(g.Players[selected].Hand, *g.PendingCard)
	g.PendingCard = nil
	
	g.Phase = PhasePenaltyReturnCard
	g.TurnCounter++
}

func (g *GameState) ReturnCard(playerIndex int, cardIndex int) error {
	if g.Phase != PhasePenaltyReturnCard { return errors.New("wrong phase") }
	if playerIndex != g.TradeReceiver { return errors.New("only trade receiver can return") }
	
	hand := g.Players[playerIndex].Hand
	if cardIndex < 0 || cardIndex >= len(hand) { return errors.New("invalid card index") }
	
	returnedCard := hand[cardIndex]
	g.Players[playerIndex].Hand = append(hand[:cardIndex], hand[cardIndex+1:]...)
	
	g.Players[g.TradeGiver].Hand = append(g.Players[g.TradeGiver].Hand, returnedCard)
	
	g.TradeIndex++
	if g.TradeIndex < g.TradeAmount {
		g.Phase = PhasePenaltyVoteLoser
		g.Votes = make(map[int]int)
	} else {
		g.Phase = PhaseTrumpSelection
		g.Turn = g.TrumpCaller
	}
	g.TurnCounter++
	return nil
}

func (g *GameState) AutoAdvancePhase() {
	if g.Phase == PhasePenaltyVoteLoser {
		// Just force votes
		for i, p := range g.Players {
			if p.Team == g.LosingTeam {
				g.Votes[i] = i // vote for themselves
			}
		}
		g.processLoserVotes()
	} else if g.Phase == PhasePenaltyVoteWinner {
		for i, p := range g.Players {
			if p.Team == g.WinningTeam {
				g.Votes[i] = i
			}
		}
		g.processWinnerVotes()
	} else if g.Phase == PhasePenaltyReturnCard {
		// Return first card
		g.ReturnCard(g.TradeReceiver, 0)
	}
}
