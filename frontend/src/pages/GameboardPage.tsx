import { useEffect, useState } from "react";
import * as gamesApi from "../api/games";
import type { ActionStatus, GameSummary, GangSummary, PhaseOneAction } from "../api/games";
import { useAuth } from "../state/auth-context";

export function GameboardPage() {
  const { user, logout } = useAuth();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [game, setGame] = useState<GameSummary | null>(null);
  const [board, setBoard] = useState<gamesApi.Gameboard | null>(null);
  const [actionStatus, setActionStatus] = useState<ActionStatus | null>(null);
  const [gang, setGang] = useState<GangSummary | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [gangName, setGangName] = useState("");
  const [selectedAction, setSelectedAction] = useState<PhaseOneAction>("buzinezz");
  const [targetGangId, setTargetGangId] = useState("");
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
  }, []);

  async function selectGame(nextGame: GameSummary) {
    setError(null);
    setGame(nextGame);
    setGang(await gamesApi.getMyGang(nextGame.id));
    const nextBoard = await gamesApi.getGame(nextGame.id);
    setBoard(nextBoard);
    setActionStatus(await gamesApi.getActionStatus(nextGame.id));
  }

  async function handleCreateGame() {
    setError(null);
    try {
      const created = await gamesApi.createGame(maxPlayers);
      await selectGame(created);
      await refreshOpenGames();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create game");
    }
  }

  async function handleJoin(gameToJoin: GameSummary) {
    setError(null);
    try {
      const joined = await gamesApi.joinGame(gameToJoin.id);
      await selectGame(joined);
      await refreshOpenGames();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not join game");
    }
  }

  async function handleCreateGang() {
    if (!game) return;
    setError(null);
    try {
      setGang(await gamesApi.createGang(game.id, gangName));
      setGangName("");
      const updatedBoard = await gamesApi.getGame(game.id);
      setGame(updatedBoard.game);
      setBoard(updatedBoard);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create gang");
    }
  }

  async function handleStartGame() {
    if (!game) return;
    setError(null);
    try {
      const started = await gamesApi.startGame(game.id);
      setGame(started);
      setBoard(await gamesApi.getGame(game.id));
      setActionStatus(await gamesApi.getActionStatus(game.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start game");
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
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit action");
    }
  }

  return (
    <main>
      <h1>Gameboard</h1>
      <p>Welcome, {user?.username}.</p>
      <button type="button" onClick={() => void logout()}>Log out</button>
      {error && <p role="alert">{error}</p>}

      {!game && (
        <section>
          <h2>Create a game</h2>
          <label>
            Players
            <select value={maxPlayers} onChange={(event) => setMaxPlayers(Number(event.target.value))}>
              {Array.from({ length: 7 }, (_, index) => index + 2).map((count) => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void handleCreateGame()}>Create lobby</button>

          <h2>Open games</h2>
          {games.length === 0 && <p>No open games yet.</p>}
          {games.map((openGame) => (
            <p key={openGame.id}>
              {openGame.memberCount}/{openGame.maxPlayers} players
              <button type="button" onClick={() => void handleJoin(openGame)}>Join</button>
            </p>
          ))}
        </section>
      )}

      {game && (
        <section>
          <h2>Lobby</h2>
          <p>{game.memberCount}/{game.maxPlayers} players joined</p>
          <p>Status: {game.status}</p>
          {!gang && game.status === "lobby" && (
            <form onSubmit={(event) => { event.preventDefault(); void handleCreateGang(); }}>
              <label>
                Gang name
                <input value={gangName} onChange={(event) => setGangName(event.target.value)} minLength={3} maxLength={30} required />
              </label>
              <button type="submit">Create gang</button>
            </form>
          )}
          {gang && <p>Gang: {gang.name} | Money: ${gang.money} | Members: {gang.members} | Notoriety: {gang.notoriety}</p>}
          {game.status === "lobby" && game.creatorUserId === user?.id && (
            <button type="button" onClick={() => void handleStartGame()}>Start game</button>
          )}
          {board?.game.status === "active" && (
            <section>
              <h2>Round {board.game.roundNumber}</h2>
              <p>Phase: {board.game.currentPhase}</p>
              <p>Neutral Turfs: {board.neutralTurfs}</p>
              <h3>Gangs</h3>
              {board.gangs.map((boardGang) => (
                <p key={boardGang.id}>
                  {boardGang.name} | ${boardGang.money} | {boardGang.members} members | Notoriety {boardGang.notoriety} | {boardGang.turfsHeld} Turfs
                </p>
              ))}
              <h3>Turfs</h3>
              {board.turfs.map((turf) => (
                <p key={turf.id}>{turf.label} | {turf.ownerGangName ?? "Neutral"}</p>
              ))}
              {actionStatus && board.game.currentPhase === "phase1" && (
                <section>
                  <h3>Phase 1 action</h3>
                  <p>{actionStatus.submittedCount}/{actionStatus.totalGangCount} gangs submitted</p>
                  {actionStatus.hasSubmitted ? <p>Your action is submitted.</p> : (
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
                              <option key={target.id} value={target.id}>{target.name}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <button type="submit">Submit Phase 1 action</button>
                    </form>
                  )}
                </section>
              )}
              {board.game.currentPhase === "phase2" && <p>Phase 1 has resolved. Phase 2 is ready for action selection.</p>}
              {board.actionLog.length > 0 && (
                <section>
                  <h3>Action log</h3>
                  {board.actionLog.map((entry) => (
                    <p key={entry.id}>
                      Round {entry.roundNumber} {entry.phase}: {entry.gangName} chose {entry.action}
                      {Object.keys(entry.rollResult).length > 0 && ` | Roll: ${JSON.stringify(entry.rollResult)}`}
                      {` | ${JSON.stringify(entry.outcome)}`}
                    </p>
                  ))}
                </section>
              )}
            </section>
          )}
          <button type="button" onClick={() => { setGame(null); setGang(null); setBoard(null); setActionStatus(null); void refreshOpenGames(); }}>Back to games</button>
        </section>
      )}
    </main>
  );
}
