# 🍪 COOKIELIKE — Game Design Document

## Concept
Roguelike de production avec **slot machine à cookies**.
Tu charges ta machine avec des recettes (= ton deck de probabilités), tu tires le levier, des cookies aléatoires remplissent des boîtes. Les combos dans les boîtes déterminent leur valeur. 15 rounds, quotas croissants, game over si raté.

> **Le coeur du jeu : manipuler les probabilités pour maximiser les combos dans tes boîtes.**

## Pipeline
```
Recettes (pool pondéré) → Levier → Boîte (5 cookies random) → Four (timing) → Benne → Vente
```

## Combos (poker-style dans les boîtes)
| Combo | Condition | Multi |
|---|---|---|
| Flush | 5 identiques | x10 |
| Carré | 4 identiques | x5 |
| Full House | 3+2 | x4 |
| Rainbow | 5 différents | x3.5 |
| Brelan | 3 identiques | x2.5 |
| Double Paire | 2+2 | x2 |
| Paire | 2 identiques | x1.5 |
| Rien | — | x1 |

## Structure d'un run
15 rounds. Chaque round: Production (temps réel) → Résultats → Choix (1/3) → Atelier (shop) → Prochain round.

## Cuisson
Barre de progression temps réel. Zones: CRU (-50%) → CUIT (x1) → PARFAIT (+25%) → BRÛLÉ (perdu).
Upgrades Skilled modifient les zones (Précision, Sweet Spot, Rythme, Speed Demon).

## Archétypes de build
- **Stratège** : optimise le pool pour des combos précis
- **Skilled** : maîtrise le timing de cuisson pour les multiplicateurs
- **Gambler** : fours spéciaux, jokers, événements lucky

## Méta-progression
Étoiles ⭐ gagnées chaque run → débloquent de nouvelles recettes, fours, toppings dans le pool de choix.

---

*Voir conversation de design pour le GDD complet.*
