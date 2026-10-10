import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import * as adminApi from "../api/admin";
import type { AdminPlayer } from "../api/admin";
import type { GameSummary } from "../api/games";

const POLL_INTERVAL_MS = 2000;

export function AdminPage() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [playerResult, gameResult] = await Promise.all([adminApi.listPlayers(), adminApi.listAllGames()]);
      setPlayers(playerResult.players);
      setGames(gameResult.games);
      setAuthorized(true);
    } catch {
      setAuthorized((current) => (current === true ? current : false));
    }
  }, []);

  useEffect(() => {
    void adminApi.isAdmin().then((ok) => {
      setAuthorized(ok);
      if (ok) void refresh();
    });
  }, [refresh]);

  useEffect(() => {
    if (!authorized) return;
    const intervalId = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [authorized, refresh]);

  async function run(action: () => Promise<unknown>, fallback: string) {
    setError(null);
    try {
      await action();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : fallback);
    }
  }

  async function handleLogout() {
    await adminApi.adminLogout();
    navigate("/");
  }

  async function handleDeleteAllGames() {
    const confirmed = window.confirm(
      "Delete every game? This permanently removes all lobbies, matches, gangs, Turfs, and action logs.",
    );
    if (confirmed) await run(() => adminApi.deleteAllGames(), "Could not delete games");
  }

  if (authorized === null) return <p>Loading...</p>;
  if (!authorized) return <Navigate to="/" replace />;

  const gameLabels = new Map(games.map((game, index) => [game.id, `Game ${games.length - index}`]));

  return (
    <main>
      <h1>Admin</h1>
      <button type="button" onClick={() => void handleLogout()}>Log out</button>
      {error && <p role="alert">{error}</p>}

      <section>
        <h2>Players in the lobby ({players.length})</h2>
        {players.length === 0 && <p>No players have joined yet.</p>}
        <ul>
          {players.map((player) => (
            <li key={player.id}>
              <strong>{player.username}</strong>
              {" "}— {player.online ? "online" : "offline"}
              {player.gameId && ` — in ${gameLabels.get(player.gameId) ?? "a game"}`}
              {" "}
              <button
                type="button"
                disabled={player.gameId !== null && games.find((game) => game.id === player.gameId)?.status === "active"}
                onClick={() => void run(() => adminApi.removePlayer(player.id), "Could not remove player")}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

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
        <button type="button" onClick={() => void run(() => adminApi.createGame(maxPlayers), "Could not create game")}>
          Create game
        </button>
      </section>

      <section>
        <h2>Games</h2>
        {games.length === 0 && <p>No games yet.</p>}
        <ul>
          {games.map((game) => (
            <li key={game.id}>
              <strong>{gameLabels.get(game.id)}</strong> — {game.status} — {game.memberCount}/{game.maxPlayers} players, {game.gangCount} gangs ready
              {" "}
              <Link to={`/gamerun/${game.id}`} target="_blank" rel="noreferrer">Open Gamerun</Link>
              {game.status === "lobby" && (
                <>
                  {" "}
                  <button
                    type="button"
                    disabled={game.memberCount < 2 || game.gangCount !== game.memberCount}
                    onClick={() => void run(() => adminApi.startGame(game.id), "Could not start game")}
                  >
                    Start game
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {games.length > 0 && (
          <button type="button" onClick={() => void handleDeleteAllGames()}>Remove all games</button>
        )}
      </section>
    </main>
  );
}
