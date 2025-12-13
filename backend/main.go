package main

import (
	"cards/server"
	"log"
	"net/http"
)

func main() {
	hub := server.NewHub()
	go hub.Run()

	fs := http.FileServer(http.Dir("../frontend/dist"))
	http.Handle("/", fs)
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		server.ServeWs(hub, w, r)
	})

	log.Println("Server started on :8080")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
