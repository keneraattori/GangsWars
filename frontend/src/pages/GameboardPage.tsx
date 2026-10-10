import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as gamesApi from "../api/games";
import type { ActionStatus, GameSummary, GangSummary, PhaseOneAction, PhaseTwoAction } from "../api/games";
import { ActionGuide } from "../components/ActionGuide";
import { ActionOutcome } from "../components/ActionOutcome";
import { useAuth } from "../state/auth-context";

const RECRUIT_COST = 3000;

export function GameboardPage() {
  const { user, logout } = useAuth();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [game, setGame] = useState<GameSummary | null>(null);
  const [board, setBoard] = useState<gamesApi.Gameboard | null>(null);
  const [actionStatus, setActionStatus] = useState<ActionStatus | null>(null);
  const [gang, setGang] = useState<GangSummary | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [selectedAction, setSelectedAction] = useState<PhaseOneAction>("buzinezz");
  const [targetGangId, setTargetGangId] = useState("");
  const [selectedPhaseTwoAction, setSelectedPhaseTwoAction] = useState<PhaseTwoAction>("earn");
  const [targetTurfId, setTargetTurfId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refreshOpenGames() {
    const result = await gamesApi.listOpenGames();
    setGames(result.games);
  }

  useEffect(() => {
    void gamesApi
      .listOpenGames()
      .then((result) => setGames(result.games))
      .catch((reason: Error) => setError(reason.message));
    // Resume the player's game after a page reload.
    void gamesApi
      .getMyGame()
      .then((result) => (result.game ? selectGame(result.game) : undefined))
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    if (game) return;

    const intervalId = window.setInterval(() => {
      void refreshOpenGames().catch((reason: Error) => setError(reason.message));
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [game]);

  async function selectGame(nextGame: GameSummary) {
    setError(null);
    setGame(nextGame);
    setGang(await gamesApi.getMyGang(nextGame.id));
    const nextBoard = await gamesApi.getGame(nextGame.id);
    setBoard(nextBoard);
    setActionStatus(nextBoard.game.status === "active" ? await gamesApi.getActionStatus(nextGame.id) : null);
  }

  useEffect(() => {
    if (!game?.id) return;
    let cancelled = false;

    const refreshSelectedGame = async () => {
      try {
        const nextBoard = await gamesApi.getGame(game.id);
        if (cancelled) return;
        setBoard(nextBoard);
        setGame(nextBoard.game);
        setGang(await gamesApi.getMyGang(game.id));
        setActionStatus(
          nextBoard.game.status === "active"
            ? await gamesApi.getActionStatus(game.id)
            : null,
        );
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not refresh game");
      }
    };

    const intervalId = window.setInterval(() => void refreshSelectedGame(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [game?.id]);

  async function handleJoin(gameToJoin: GameSummary) {
    setError(null);
    try {
      const joined = await gamesApi.joinGame(gameToJoin.id);
      await selectGame(joined);
      await refreshOpenGames();
    } catch (reason) {
      if (reason instanceof Error && reason.message === "You have already joined this game") {
        await selectGame(gameToJoin);
        return;
      }
      setError(reason instanceof Error ? reason.message : "Could not join game");
    }
  }

  async function handleCreateGang() {
    if (!game || !selectedCharacterId) return;
    setError(null);
    try {
      setGang(await gamesApi.createGang(game.id, selectedCharacterId));
      setSelectedCharacterId(null);
      const updatedBoard = await gamesApi.getGame(game.id);
      setGame(updatedBoard.game);
      setBoard(updatedBoard);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create gang");
    }
  }

  async function handleSubmitAction() {
    if (!game) return;
    setError(null);
    try {
      const result = await gamesApi.submitPhaseOneAction(
        game.id,
        selectedAction,
        selectedAction === "beef" || selectedAction === "attack" ? targetGangId : undefined,
      );
      setActionStatus(result.status);
      if (result.resolved) {
        const updatedBoard = await gamesApi.getGame(game.id);
        setGame(updatedBoard.game);
        setBoard(updatedBoard);
        const updatedGang = updatedBoard.gangs.find((boardGang) => boardGang.id === gang?.id);
        if (updatedGang) setGang(updatedGang);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit action");
    }
  }

  async function handleSubmitPhaseTwoAction() {
    if (!game) return;
    setError(null);
    try {
      const result = await gamesApi.submitPhaseTwoAction(
        game.id,
        selectedPhaseTwoAction,
        selectedPhaseTwoAction === "expand" ? targetTurfId : undefined,
      );
      setActionStatus(result.status);
      if (result.resolved) {
        const updatedBoard = await gamesApi.getGame(game.id);
        setGame(updatedBoard.game);
        setBoard(updatedBoard);
        const updatedGang = updatedBoard.gangs.find((boardGang) => boardGang.id === gang?.id);
        if (updatedGang) setGang(updatedGang);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit Phase 2 action");
    }
  }

  const incomingAttacks = board && gang && board.game.status === "active" && board.game.currentPhase === "phase1"
    ? board.actionLog.filter((entry) =>
      entry.phase === "phase1"
      && entry.action === "attack"
      && entry.roundNumber === board.game.roundNumber - 1
      && typeof entry.outcome.targetGangId === "string"
      && entry.outcome.targetGangId === gang.id)
    : [];

  const incomingStolenTurfs = board && gang && board.game.status === "active" && board.game.currentPhase === "phase1"
    ? board.actionLog.flatMap((entry) => {
      if (entry.phase !== "phase2"
        || entry.action !== "expand"
        || entry.roundNumber !== board.game.roundNumber - 1
        || entry.outcome.success !== true
        || entry.outcome.targetGangId !== gang.id
        || typeof entry.outcome.targetTurfId !== "string") {
        return [];
      }
      const turf = board.turfs.find((candidate) => candidate.id === entry.outcome.targetTurfId);
      return turf ? [{ id: entry.id, gangName: entry.gangName, turfName: turf.label }] : [];
    })
    : [];

  const incomingFailedExpands = board && gang && board.game.status === "active" && board.game.currentPhase === "phase1"
    ? board.actionLog.flatMap((entry) => {
      if (entry.phase !== "phase2"
        || entry.action !== "expand"
        || entry.roundNumber !== board.game.roundNumber - 1
        || entry.outcome.success !== false
        || entry.outcome.targetGangId !== gang.id
        || typeof entry.outcome.targetTurfId !== "string") {
        return [];
      }
      const turf = board.turfs.find((candidate) => candidate.id === entry.outcome.targetTurfId);
      return turf ? [{ id: entry.id, gangName: entry.gangName, turfName: turf.label }] : [];
    })
    : [];

  return (
    <main className={board && (board.game.status === "active" || board.game.status === "finished") ? "game-screen" : undefined}>
      {error && <p role="alert">{error}</p>}

      {!game && (
        <section>
          <h2>Lobby</h2>
          <p>
            You are playing as <strong>{user?.username}</strong>.{" "}
            <button type="button" onClick={() => void logout()}>Leave lobby</button>
          </p>
          <h2>Open games</h2>
          {games.length === 0 && <p>Waiting for the admin to create a game.</p>}
          {games.map((openGame) => (
            <p key={openGame.id}>
              {openGame.memberCount}/{openGame.maxPlayers} players
              <button type="button" disabled={openGame.memberCount >= openGame.maxPlayers} onClick={() => void handleJoin(openGame)}>Join</button>
            </p>
          ))}
          <ActionGuide />
        </section>
      )}

      {game && (
        <section>
          {game.status === "lobby" && <h2>Game lobby</h2>}
          {!gang && game.status === "lobby" && (
            <form onSubmit={(event) => { event.preventDefault(); void handleCreateGang(); }}>
              <fieldset className="character-picker">
                <legend>Choose a character for {user?.username}</legend>
                <div className="character-grid">
                  {Array.from({ length: 21 }, (_, index) => index + 1).map((characterId) => {
                    const taken = board?.gangs.some((boardGang) => boardGang.characterId === characterId) ?? false;
                    return (
                      <label key={characterId} className={taken ? "character-option is-taken" : "character-option"}>
                        <input
                          type="radio"
                          name="character"
                          value={characterId}
                          checked={selectedCharacterId === characterId}
                          disabled={taken}
                          onChange={() => setSelectedCharacterId(characterId)}
                          required
                        />
                        <img src={`/characters/character_${String(characterId).padStart(2, "0")}.png`} alt={`Character ${characterId}${taken ? " (taken)" : ""}`} />
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <button type="submit" disabled={!selectedCharacterId}>Create gang</button>
            </form>
          )}
          {game.status === "lobby" && (
            <>
              <p>{game.gangCount}/{game.memberCount} gangs created</p>
              <p>Waiting for the admin to start the game.</p>
              <ActionGuide />
            </>
          )}
          {board && (board.game.status === "active" || board.game.status === "finished") && (
            <section className="match-board">
              <aside className="board-rail">
                <section className="board-panel gang-panel">
                  <div className="gang-identity">
                    <p className="panel-kicker">Your gang</p>
                    <h2 className="gang-name-heading">
                      {gang && <img className="gang-avatar gang-avatar-large" src={characterImageUrl(gang.characterId)} alt="" />}
                      {gang?.name ?? "No gang"}
                    </h2>
                  </div>
                  <dl className="stat-list">
                    <div><dt>Money</dt><dd>${gang?.money ?? 0}</dd></div>
                    <div><dt>Members</dt><dd>{gang?.members ?? 0}</dd></div>
                    <div><dt>Notoriety</dt><dd>{gang?.notoriety ?? 0}</dd></div>
                    <div><dt>Turfs</dt><dd>{gang?.turfsHeld ?? 0}</dd></div>
                  </dl>
                </section>
                <section className="board-panel action-panel">
                  <div className="panel-heading">
                    <p className="panel-kicker">Round {board.game.roundNumber}</p>
                  </div>
                  {incomingAttacks.map((entry) => (
                    <p className="incoming-event-notice" key={entry.id} role="status">
                      {entry.gangName} attacked you
                    </p>
                  ))}
                  {incomingStolenTurfs.map((entry) => (
                    <p className="incoming-event-notice" key={entry.id} role="status">
                      {entry.gangName} stole {entry.turfName}
                    </p>
                  ))}
                  {incomingFailedExpands.map((entry) => (
                    <p className="incoming-event-notice incoming-event-notice--warning" key={entry.id} role="status">
                      {entry.gangName} failed to expand to your {entry.turfName}
                    </p>
                  ))}
                  <h2>{board.game.currentPhase === "phase1" ? "Phase 1 action" : "Phase 2 action"}</h2>
                  {actionStatus && <p className="submission-count">{actionStatus.submittedCount}/{actionStatus.totalGangCount} gangs submitted</p>}
                  {board.game.status === "finished" && <p>Game finished. Winner: {board.gangs.find((boardGang) => boardGang.id === board.game.winnerGangId)?.name ?? "Unknown"}</p>}
                  {board.game.status === "active" && actionStatus && board.game.currentPhase === "phase1" && (
                    actionStatus.hasSubmitted ? <><p>Your action is submitted.</p><p className="submitted-action">Selected action: {actionStatus.submittedAction}</p></> : (
                      <form onSubmit={(event) => { event.preventDefault(); void handleSubmitAction(); }}>
                        <label>
                          Action
                          <select value={selectedAction} onChange={(event) => setSelectedAction(event.target.value as PhaseOneAction)}>
                            <option value="beef">Beef</option>
                            <option value="buzinezz">Buzinezz</option>
                            <option value="show_off">Show off!</option>
                            <option value="attack">Attack</option>
                          </select>
                        </label>
                        {(selectedAction === "beef" || selectedAction === "attack") && (
                          <label>
                            Target gang
                            <select value={targetGangId} onChange={(event) => setTargetGangId(event.target.value)} required>
                              <option value="">Select a gang</option>
                              {board.gangs.filter((boardGang) => boardGang.id !== gang?.id).map((target) => (
                                <option key={target.id} value={target.id}>
                                  {target.name}
                                  {selectedAction === "attack" && board.protectedGangIds.includes(target.id) ? " — Protected (-1 damage)" : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <button type="submit">Submit action</button>
                      </form>
                    )
                  )}
                  {board.game.status === "active" && actionStatus && board.game.currentPhase === "phase2" && (
                    actionStatus.hasSubmitted ? <><p>Your action is submitted.</p><p className="submitted-action">Selected action: {actionStatus.submittedAction}</p></> : (
                      <form onSubmit={(event) => { event.preventDefault(); void handleSubmitPhaseTwoAction(); }}>
                        <label>
                          Action
                          <select value={selectedPhaseTwoAction} onChange={(event) => setSelectedPhaseTwoAction(event.target.value as PhaseTwoAction)}>
                            <option value="earn">Earn</option>
                            <option value="expand">Expand</option>
                            <option value="recruit" disabled={(gang?.money ?? 0) < RECRUIT_COST}>Recruit ($3,000)</option>
                            <option value="protect">Protect</option>
                          </select>
                        </label>
                        {gang && gang.money < RECRUIT_COST && (
                          <p className="submission-count">Recruit requires $3,000. Your gang has ${gang.money.toLocaleString()}.</p>
                        )}
                        {selectedPhaseTwoAction === "expand" && (
                          <label>
                            Target Turf
                            <select value={targetTurfId} onChange={(event) => setTargetTurfId(event.target.value)} required>
                              <option value="">Select a Turf</option>
                              {board.turfs.filter((turf) => turf.ownerGangId !== gang?.id).map((turf) => (
                                <option key={turf.id} value={turf.id}>
                                  {turf.label} ({turf.ownerGangName ?? "Neutral"})
                                  {turf.ownerGangId && board.protectedGangIds.includes(turf.ownerGangId) ? " — Protected" : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <button type="submit" disabled={selectedPhaseTwoAction === "recruit" && (gang?.money ?? 0) < RECRUIT_COST}>Submit action</button>
                      </form>
                    )
                  )}
                </section>
              </aside>
              <section className="board-center">
                <section className="board-panel game-panel">
                  <div className="game-heading">
                    <div>
                      <p className="panel-kicker">Live game</p>
                      <h2>Round {board.game.roundNumber}</h2>
                    </div>
                    <p className="phase-badge">{board.game.currentPhase}</p>
                  </div>
                  <p>{board.game.memberCount}/{board.game.maxPlayers} players joined</p>
                  <h3>Gangs</h3>
                  <ul className="gang-list">
                    {board.gangs.map((boardGang) => (
                      <li key={boardGang.id}>
                        <strong className="gang-name-with-avatar">
                          {boardGang.name}
                          <img className="gang-avatar" src={characterImageUrl(boardGang.characterId)} alt="" />
                        </strong>
                        <span>${boardGang.money} | {boardGang.members} members | Notoriety {boardGang.notoriety} | {boardGang.turfsHeld} Turfs</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="board-panel log-panel">
                  <p className="panel-kicker">History</p>
                  <h2>Action log</h2>
                  {board.actionLog.length === 0 ? <p>No actions resolved yet.</p> : (
                    <ul className="action-log">
                      {board.actionLog.map((entry) => {
                        const targetGangId = entry.outcome.targetGangId;
                        const targetGangName = entry.phase === "phase1" && entry.action === "attack" && typeof targetGangId === "string"
                          ? board.gangs.find((candidate) => candidate.id === targetGangId)?.name
                          : undefined;
                        const targetTurfId = entry.outcome.targetTurfId;
                        const targetTurfName = entry.phase === "phase2" && entry.action === "expand" && typeof targetTurfId === "string"
                          ? board.turfs.find((candidate) => candidate.id === targetTurfId)?.label
                          : undefined;

                        return (
                          <li key={entry.id}>
                            <div><strong>Round {entry.roundNumber} {entry.phase}</strong>: {entry.gangName} chose {entry.action}{targetGangName ? ` targeting ${targetGangName}` : ""}{targetTurfName ? ` targeting ${targetTurfName}` : ""}</div>
                            <small className="action-details">
                              {Object.keys(entry.rollResult).length > 0 && `Roll: ${JSON.stringify(entry.rollResult)} | `}
                              Outcome: <ActionOutcome
                                outcome={entry.outcome}
                                highlightExpandResult={entry.phase === "phase2" && entry.action === "expand"}
                              />
                            </small>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </section>
              <section className="board-panel turf-panel">
                <p className="panel-kicker">Territory</p>
                <h2>Turf control</h2>
                <p className="neutral-count">{board.neutralTurfs} neutral Turfs</p>
                <ul className="turf-list">
                  {board.turfs.map((turf) => (
                    <li key={turf.id}>
                      <span>{turf.label}</span>
                      <strong className="turf-owner">
                        {turf.ownerGangId && board.protectedGangIds.includes(turf.ownerGangId) && (
                          <img className="protect-shield-icon" src="/protect-shield.png" alt="Defend active" />
                        )}
                        {turf.ownerGangName ?? "Neutral"}
                        {turf.ownerGangId && (() => {
                          const owner = board.gangs.find((boardGang) => boardGang.id === turf.ownerGangId);
                          return owner ? (
                            <img className="gang-avatar" src={characterImageUrl(owner.characterId)} alt="" />
                          ) : null;
                        })()}
                      </strong>
                    </li>
                  ))}
                </ul>
              </section>
            </section>
          )}
          <div className="game-page-actions">
            <button type="button" onClick={() => { setGame(null); setGang(null); setBoard(null); setActionStatus(null); void refreshOpenGames(); }}>Back to games</button>
            <Link className="gamerun-link" to={`/gamerun/${game.id}`} target="_blank" rel="noreferrer">Open projector view</Link>
            <button className="logout-button" type="button" onClick={() => void logout()}>Log out</button>
          </div>
          {board && (board.game.status === "active" || board.game.status === "finished") && (
            <ActionGuide />
          )}
        </section>
      )}
    </main>
  );
}

function characterImageUrl(characterId: number): string {
  return `/characters/character_${String(characterId).padStart(2, "0")}.png`;
}
