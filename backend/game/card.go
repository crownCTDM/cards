package game

import (
	"errors"
	"fmt"
	"math/rand"
	"time"
)

type Suit string
type Rank int

const (
	Spades   Suit = "Spades"
	Hearts   Suit = "Hearts"
	Diamonds Suit = "Diamonds"
	Clubs    Suit = "Clubs"
)

const (
	Two   Rank = 2
	Three Rank = 3
	Four  Rank = 4
	Five  Rank = 5
	Six   Rank = 6
	Seven Rank = 7
	Eight Rank = 8
	Nine  Rank = 9
	Ten   Rank = 10
	Jack  Rank = 11
	Queen Rank = 12
	King  Rank = 13
	Ace   Rank = 14
)

type Card struct {
	Suit Suit `json:"suit"`
	Rank Rank `json:"rank"`
}

func (c Card) String() string {
	return fmt.Sprintf("%d of %s", c.Rank, c.Suit)
}

type Deck []Card

func NewDeck() Deck {
	suits := []Suit{Spades, Hearts, Diamonds, Clubs}
	ranks := []Rank{Two, Three, Four, Five, Six, Seven, Eight, Nine, Ten, Jack, Queen, King, Ace}
	deck := make(Deck, 0, 52)

	for _, s := range suits {
		for _, r := range ranks {
			deck = append(deck, Card{Suit: s, Rank: r})
		}
	}
	return deck
}

func (d *Deck) Shuffle() {
	src := rand.NewSource(time.Now().UnixNano())
	r := rand.New(src)
	for i := range *d {
		j := r.Intn(i + 1)
		(*d)[i], (*d)[j] = (*d)[j], (*d)[i]
	}
}

func (d *Deck) Draw(n int) ([]Card, error) {
	if len(*d) < n {
		return nil, errors.New("not enough cards")
	}
	cards := (*d)[:n]
	*d = (*d)[n:]
	return cards, nil
}
