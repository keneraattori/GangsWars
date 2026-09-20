import { useEffect, useState } from "react";
import * as gamesApi from "../api/games";
import type { GameSummary, GangSummary } from "../api/games";
import { useAuth } from "../state/auth-context";

export function GameboardPage() {
  const { user, logout } = useAuth();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [game, setGame] = useState<GameSummary | null>(null);
  const [gang, setGang] = useState<GangSummary | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [gangName, setGangName] = useState("");
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
      setGame(await gamesApi.getGame(game.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create gang");
    }
  }

  async function handleStartGame() {
    if (!game) return;
    setError(null);
    try {
      setGame(await gamesApi.startGame(game.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start game");
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
          {game.status === "active" && <p>The game has started. The full action board arrives in M3.</p>}
          <button type="button" onClick={() => { setGame(null); setGang(null); void refreshOpenGames(); }}>Back to games</button>
        </section>
      )}
    </main>
  );
}
