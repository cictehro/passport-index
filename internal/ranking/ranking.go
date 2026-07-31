package ranking

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

type RankEntry struct {
	Rank     int     `json:"rank"`
	Passport string  `json:"passport"`
	Score    float64 `json:"score"`
}

type Countries map[string]string

func load() ([]RankEntry, Countries, error) {
	rankData, err := os.ReadFile("./generated/rankings.json")
	if err != nil {
		return nil, nil, fmt.Errorf("rankings.json: %w", err)
	}

	countriesData, err := os.ReadFile("./data/countries.json")
	if err != nil {
		return nil, nil, fmt.Errorf("countries.json: %w", err)
	}

	var rankings []RankEntry
	if err := json.Unmarshal(rankData, &rankings); err != nil {
		return nil, nil, err
	}

	var countries Countries
	if err := json.Unmarshal(countriesData, &countries); err != nil {
		return nil, nil, err
	}

	return rankings, countries, nil
}

func countryName(countries Countries, code string) string {
	if name, ok := countries[code]; ok {
		return name
	}
	return code
}

func ShowRank(code string) {
	code = strings.ToUpper(code)

	rankings, countries, err := load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	// Load visa-free counts too
	vfcData, _ := os.ReadFile("./generated/visa-free-counts.json")
	var vfc map[string]int
	json.Unmarshal(vfcData, &vfc)

	// Load scores
	scoresData, _ := os.ReadFile("./generated/scores.json")
	var scores map[string]float64
	json.Unmarshal(scoresData, &scores)

	for _, entry := range rankings {
		if entry.Passport == code {
			name := countryName(countries, code)
			fmt.Printf("\n%s (%s)\n", name, code)
			fmt.Println(strings.Repeat("─", 30))
			fmt.Printf("  Rank          : #%d of %d\n", entry.Rank, len(rankings))
			fmt.Printf("  Mobility score: %.1f\n", scores[code])
			fmt.Printf("  Visa free     : %d destinations\n", vfc[code])
			fmt.Println()
			return
		}
	}

	fmt.Fprintf(os.Stderr, "✗ Unknown passport: %s\n", code)
	os.Exit(1)
}

func ShowTop(n int) {
	rankings, countries, err := load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	if n < 0 {
		n = 0
	}
	if n > len(rankings) {
		n = len(rankings)
	}

	fmt.Printf("\nTop %d passports\n", n)
	fmt.Println(strings.Repeat("─", 40))
	fmt.Printf("%-5s %-25s %s\n", "Rank", "Country", "Score")
	fmt.Println(strings.Repeat("─", 40))

	for _, entry := range rankings[:n] {
		name := countryName(countries, entry.Passport)
		fmt.Printf("%-5d %-25s %.1f\n", entry.Rank, name, entry.Score)
	}
	fmt.Println()
}
