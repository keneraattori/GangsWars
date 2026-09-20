# Game Design — Gang Turf Wars

Status: **draft v0.2** — rules as specified, with design decisions confirmed in [§7](#7-resolved-design-decisions).

## 1. Core Loop

1. A number of players (**2–8** per game) join a **Game** (a lobby/match).
2. The game board starts with **20 neutral Turfs**.
3. The game proceeds in **Rounds**. Each Round has **Phase 1** and **Phase 2**.
4. In each phase, every player privately selects **one action**. Nobody sees other players' choices until all players have chosen, or a **10-minute phase timeout** elapses. Behavior for a gang that hasn't submitted when the timeout hits: treated as taking no action for that phase (no roll, no bonus) — revisit if this needs to be friendlier for real users.
5. Once all players have submitted (or the timeout hits), the phase is **resolved**: dice/random rolls are made, results are applied, and a public **Action Log** entry is created for every gang's action + roll + outcome.
6. Phase 1 resolves → Phase 2 begins → Phase 2 resolves → next Round's Phase 1 begins.
7. First gang to control **12 Turfs** wins the game immediately.

## 2. Gang

Created once per player, per game (one gang per user per game — see [DATA_MODEL.md](DATA_MODEL.md)).

| Attribute | Starting value | Notes |
|---|---|---|
| Gang name | user-provided | free text, must be unique per game (suggested) |
| Money ($) | 10,000 | modified by Earn / Buzinezz |
| Members | 20 | modified by Attack (loss), Recruit (gain), successful Expand (gain) |
| Notoriety | 0 | mechanic not yet defined — reserved for future use |
| Turfs controlled | 0 | starts with none; first Turfs come from the 20 neutral pool |

Members can be reduced to 0 or below with **no special effect yet** — no elimination mechanic exists (a gang keeps playing, submitting actions, and holding Turfs regardless of Member count). Reserved for future design.

## 3. Turfs

- 20 Turfs exist at game start, all **neutral**, each assigned a random unique name drawn from [TURF_NAMES.md](TURF_NAMES.md) (100-name pool).
- A Turf is owned by at most one gang, or neutral.
- Turfs move from neutral → gang, or gang A → gang B, only via a successful **Expand** action.
- Win condition: first gang to reach **12 Turfs**.

## 4. Phases & Actions

Each player picks exactly one action per phase. Actions from Phase 1 can modify the *same player's* Phase 2 action (see bonuses below) — unless noted otherwise, bonuses do **not** apply to other players.

### Phase 1

| Action | Effect |
|---|---|
| **Beef** | Player selects one other gang (target). Grants **+2** to this player's Expand roll in Phase 2, when Expanding against that same target. |
| **Buzinezz** | Grants a **+$1,000** bonus to this player's Phase 2 **Earn** action, if selected. |
| **Show off!** | Grants **+5** bonus to this player's Phase 2 **Recruit** action, if selected. |
| **Attack** | Select one other gang. Deal random **1–5** damage. Each point of damage removes **1 member** from the target gang. No cost, no failure chance — always lands. |

Bonuses from Phase 1 (Beef/Buzinezz/Show off!) only apply if the **same gang** selects the matching Phase 2 action in the **same round**.

Note on Attack + Protect interaction: Attack has no hit/miss check (it always lands), so Protect's -2 penalty against an Attack applies to the **damage roll**, not a success check — e.g. a protected gang takes `max(0, damageRoll - 2)` damage instead of the raw 1–5 roll.

### Phase 2

| Action | Effect |
|---|---|
| **Earn** | Gain random **$2,000–$5,000**. Add Buzinezz bonus (+$1,000) if it was selected in Phase 1. |
| **Expand** | Attempt to capture a Turf: <br>• **Vs. neutral**: roll 2–12 (2d6). Result **≥ 6** → capture succeeds. <br>• **Vs. another player's Turf**: roll 2–12, **+2** if Beef was used on that target in Phase 1. Result **≥ 8** → capture succeeds: one Turf moves from defender to attacker. <br>• On **any** successful capture, attacker also gains **1d6 (1–6)** members. <br>• Apply defender's Protect penalty (-2) if active (see below), where "active" means Protect was selected in the *previous round's* Phase 2 (see Protect row). <br>• **Simultaneous conflict**: if two or more gangs Expand into the *same* neutral Turf in the same phase, resolve with a roll-off: each contender rolls 2d6, and whichever contender has more Members gets **+1** to their roll-off roll. Highest roll-off result wins the Turf (re-roll ties among the tied contenders only). |
| **Recruit** | Gain random **2–12** members (2d6). Add Show off! bonus (+5) if it was selected in Phase 1. |
| **Protect** | A Phase 2 action. Grants **-2** penalty to any Expand or Attack roll made **against this gang** during the **next Round's Phase 1** (Phase 2 is the last phase of the round, so the protection window is the following round's Phase 1). |

### Roll notation

All "random X–Y" ranges described as 2–12 are 2d6 (two six-sided dice summed); 1–6 ranges are 1d6; Attack's "1–5" damage is currently a uniform integer from 1 through 5. Exact RNG implementation is an engineering detail (see [ARCHITECTURE.md](ARCHITECTURE.md)), but the *probability distribution* described here must be preserved so implementers should use the dice notation, not `Math.random()*11+2` flat distributions.

## 5. Gameboard (front page)

Must display, at minimum:

- Current round number
- Every gang that has joined the game, with live stats: name, Money, Members, Notoriety, Turfs held
- The neutral Turfs remaining
- A log of actions taken each phase: which gang, which action, roll result(s), and outcome — visible after that phase resolves

## 6. Future / Explicitly Deferred

- Real-time/interactive resolution (players see each other's moves affect the board live) — deferred; MVP resolves phases once all players have submitted (or a stub trigger for local testing).
- Notoriety mechanic — attribute exists, effect TBD.
- More than 2 phases per round, additional actions, additional resources — not in scope yet.

## 7. Resolved Design Decisions

Formerly "Open Questions" — kept as a decisions log so the reasoning isn't lost. Rules text elsewhere in this doc already reflects these.

1. **Lobby size**: 2–8 players per game.
2. **Beef targeting**: confirmed — selecting *another gang (player)*, not a specific member unit.
3. **Simultaneous Expand conflicts**: roll-off among contenders (2d6 each); the contender with more Members gets +1 to their roll-off roll; highest wins; re-roll ties.
4. **Elimination**: none yet. Members can hit 0 or go negative with no special effect — no elimination mechanic exists yet.
5. **Protect duration/scope**: applies to Expand/Attack rolls made against the gang during the *next Round's Phase 1*.
6. **Buzinezz/Show off!/Beef bonus condition**: confirmed — bonus applies only if the same gang picks the matching Phase 2 action in the same round.
7. **Attack cost/risk**: no cost, no failure chance — always lands for a random 1–5 damage (reduced by Protect, see §4 note).
8. **Money usage**: not spent on anything yet beyond being a scoreboard stat.
9. **Phase timing**: 10-minute timeout per phase. A gang that hasn't submitted when it elapses is treated as taking no action that phase (no roll, no bonus).
10. **Turf identity**: named turfs — 20 unique names randomly drawn per game from the 100-name pool in [TURF_NAMES.md](TURF_NAMES.md). Purely cosmetic.

### Still open (minor, non-blocking)
- Exact UX for a gang that misses the 10-minute timeout (just skipped silently, or shown as "forfeited" in the Action Log?) — can be decided at the milestone that implements phase timeouts.


## 8. Worked Example (for shared understanding)

Round 1, Phase 1: Gang A picks **Beef** on Gang B. Gang B picks **Buzinezz**.
Round 1, Phase 2: Gang A picks **Expand** vs. Gang B's Turf → roll 2d6 + 2 (Beef bonus) ≥ 8 → success → Gang B loses 1 Turf, Gang A gains it + 1d6 members. Gang B picks **Earn** → 2d6-derived $2,000–$5,000 + $1,000 (Buzinezz bonus).
