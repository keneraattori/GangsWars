# Game Design — Gang Turf Wars

Status: **current MVP rules** — implemented rules and decisions are recorded in [§7](#7-resolved-design-decisions).

## 1. Core Loop

1. A number of players (**2–8** per game) join a **Game** (a lobby/match).
2. The game board starts with **20 neutral Turfs**.
3. The game proceeds in **Rounds**. Each Round has **Phase 1** and **Phase 2**.
4. In each phase, every player privately selects **one action**. Players can see their own submitted action and the submission count, but not other players' choices until all players have chosen or a **10-minute phase timeout** elapses. A gang that hasn't submitted when the timeout hits receives a server-generated skip action with no gameplay effect.
5. Once all players have submitted (or the timeout hits), the phase is **resolved**: dice/random rolls are made, results are applied, and a public **Action Log** entry is created for every gang's action + roll + outcome.
6. Phase 1 resolves → Phase 2 begins → Phase 2 resolves → next Round's Phase 1 begins.
7. First gang to control **12 Turfs** wins the game immediately.

## 2. Gang

Created once per player, per game (one gang per user per game — see [DATA_MODEL.md](DATA_MODEL.md)). Each gang must select one of the 21 character portraits in `frontend/public/characters/`; a portrait can be used only once in a game.

| Attribute | Starting value | Notes |
|---|---|---|
| Gang name | user-provided | 3–30 characters; unique per game |
| Profile picture | selected from 21 supplied character images | required; unique per game |
| Money ($) | 10,000 | modified by Earn / Buzinezz; spent on Recruit |
| Members | 20 | modified by Attack (loss), Recruit (gain), successful Expand (loss) |
| Notoriety | 0 | +1 per damaging Phase 1 Attack by this gang, capped at 10; other effects TBD |
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
| **Attack** | Select one other gang. Deal random **1–5** base damage. If the target has active Protect, subtract **1** (minimum 0). Each point of final damage removes **1 member** from the target gang. The attacking gang gains **+1 Notoriety** when damage is dealt, up to a maximum of 10. No cost or miss chance. |

Bonuses from Phase 1 (Beef/Buzinezz/Show off!) only apply if the **same gang** selects the matching Phase 2 action in the **same round**.

### Phase 2

| Action | Effect |
|---|---|
| **Earn** | Gain random **$2,000–$5,000**. Add Buzinezz bonus (+$1,000) if it was selected in Phase 1. |
| **Expand** | Attempt to capture a Turf: <br>• **Vs. neutral**: roll 2–12 (2d6). Result **≥ 6** → capture succeeds. <br>• **Vs. another player's Turf**: roll 2–12, **+2** if Beef was used on that target in Phase 1, and **-2** if the target gang selected Protect in the current Phase 2. Result **≥ 8** → capture succeeds: one Turf moves from defender to attacker. <br>• On **any** successful capture, attacker loses **1d6 (1–6)** members. <br>• **Simultaneous conflict**: if two or more gangs Expand into the *same* neutral Turf in the same phase, resolve with a roll-off: each contender rolls 2d6, and whichever contender has more Members gets **+1** to their roll-off roll. Highest roll-off result wins the Turf (re-roll ties among the tied contenders only). |
| **Recruit** | Costs **$3,000**. Gain random **2–12** members (2d6). Add Show off! bonus (+5) if it was selected in Phase 1. Requires at least $3,000. |
| **Protect** | A Phase 2 action. Starting in the next round, protects this gang for two rounds. Applies a **-2** penalty to contested Expand rolls targeting its Turfs and subtracts **1** from Attack damage against this gang (minimum 0). It does not modify neutral Turf expansion. |

### Roll notation

All "random X–Y" ranges described as 2–12 are 2d6 (two six-sided dice summed); 1–6 ranges are 1d6; Attack's "1–5" damage is currently a uniform integer from 1 through 5. Exact RNG implementation is an engineering detail (see [ARCHITECTURE.md](ARCHITECTURE.md)), but the *probability distribution* described here must be preserved so implementers should use the dice notation, not `Math.random()*11+2` flat distributions.

## 5. Gameboard (front page)

Must display, at minimum:

- Current round number
- Every gang that has joined the game, with live stats: name, Money, Members, Notoriety, Turfs held
- The neutral Turfs remaining
- A log of actions taken each phase: which gang, which action, roll result(s), and outcome — visible after that phase resolves
- A full Phase 1 and Phase 2 action guide during gang creation, in the lobby, and at the bottom of the player gameboard
- At the next Phase 1, each player is notified under the round label of gangs that attacked them or successfully expanded into their Turfs in the previous round (red text), and of failed Expand attempts against their Turfs (orange text)

## 6. Future / Explicitly Deferred

- Real-time/interactive resolution (players see each other's moves affect the board live) — deferred; MVP resolves phases once all players have submitted (or a stub trigger for local testing).
- Additional Notoriety effects beyond the Phase 1 Attack award — reserved for future design.
- More than 2 phases per round, additional actions, additional resources — not in scope yet.

## 7. Resolved Design Decisions

Formerly "Open Questions" — kept as a decisions log so the reasoning isn't lost. Rules text elsewhere in this doc already reflects these.

1. **Lobby size**: 2–8 players per game.
2. **Beef targeting**: confirmed — selecting *another gang (player)*, not a specific member unit.
3. **Simultaneous Expand conflicts**: roll-off among contenders (2d6 each); the contender with more Members gets +1 to their roll-off roll; highest wins; re-roll ties.
4. **Elimination**: none yet. Members can hit 0 or go negative with no special effect — no elimination mechanic exists yet.
5. **Protect duration/scope**: Protect selected in Round R applies -2 to contested Expand rolls targeting the protecting gang's owned Turfs and subtracts 1 from Attack damage against that gang during Rounds R+1 and R+2. It does not apply during Round R.
6. **Buzinezz/Show off!/Beef bonus condition**: confirmed — bonus applies only if the same gang picks the matching Phase 2 action in the same round.
7. **Attack cost/risk**: no cost or miss chance; base damage is random 1–5, reduced by 1 (minimum 0) against a gang with active Protect.
8. **Money usage**: Recruit costs $3,000 and is unavailable when a gang has less than $3,000.
9. **Phase timing**: 10-minute timeout per phase. A gang that hasn't submitted when it elapses is treated as taking no action that phase (no roll, no bonus).
10. **Turf identity**: named turfs — 20 unique names randomly drawn per game from the 100-name pool in [TURF_NAMES.md](TURF_NAMES.md). Purely cosmetic.
11. **Attack Notoriety**: the attacking gang gains +1 Notoriety when Phase 1 Attack deals damage, up to a maximum of 10.

### Still open (minor, non-blocking)
- Exact UX for a gang that misses the 10-minute timeout (just skipped silently, or shown as "forfeited" in the Action Log?) — can be decided at the milestone that implements phase timeouts.


## 8. Worked Example (for shared understanding)

Round 1, Phase 1: Gang A picks **Beef** on Gang B. Gang B picks **Buzinezz**.
Round 1, Phase 2: Gang A picks **Expand** vs. Gang B's Turf → roll 2d6 + 2 (Beef bonus) ≥ 8 → success → Gang B loses 1 Turf, Gang A gains it and loses 1d6 members. Gang B picks **Earn** → 2d6-derived $2,000–$5,000 + $1,000 (Buzinezz bonus).
