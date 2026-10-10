import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import * as gamesApi from "../api/games";
import type { PublicGameboard } from "../api/games";
import { ActionOutcome } from "../components/ActionOutcome";

export function GamerunPage() {
  const { gameId } = useParams();
  const [board, setBoard] = useState<PublicGameboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(0);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const nextBoard = await gamesApi.getPublicGameboard(gameId);
        if (!cancelled) {
          setBoard(nextBoard);
          setError(null);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Could not load game");
        }
      }
    };

    void refresh();
    const refreshInterval = window.setInterval(() => void refresh(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [gameId]);

  useEffect(() => {
    const clockInterval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(clockInterval);
  }, []);

  if (error && !board) {
    return <main className="gamerun-page"><p role="alert">{error}</p></main>;
  }
  if (!board) {
    return <main className="gamerun-page"><p>Loading game…</p></main>;
  }

  const { game } = board;
  const secondsRemaining = game.phaseDeadline && clockNow > 0
    ? Math.max(0, Math.ceil((new Date(game.phaseDeadline).getTime() - clockNow) / 1000))
    : null;
  const progressPercent = board.totalGangCount > 0
    ? Math.min(100, (board.submittedCount / board.totalGangCount) * 100)
    : 0;
  const winner = board.gangs.find((gang) => gang.id === game.winnerGangId);

  return (
    <main className="gamerun-page">
      <header className="gamerun-header">
        <div>
          <p className="gamerun-eyebrow">Turf Wars · Live match</p>
          <h1>{game.status === "finished" ? "Game complete" : game.status === "lobby" ? "Game lobby" : `Round ${game.roundNumber}`}</h1>
        </div>
        <div className="gamerun-status">
          <span className={`gamerun-status-indicator is-${game.status}`} />
          <span>{game.status}</span>
        </div>
      </header>

      {error && <p className="gamerun-error" role="alert">{error} — retrying…</p>}

      {game.status === "active" && (
        <section className="gamerun-progress board-panel" aria-label="Phase progress">
          <div className="gamerun-progress-heading">
            <div>
              <p className="gamerun-eyebrow">Current phase</p>
              <h2>{game.currentPhase === "phase1" ? "Phase 1" : "Phase 2"}</h2>
            </div>
            <div className="gamerun-progress-count">
              <strong>{board.submittedCount}<span> / {board.totalGangCount}</span></strong>
              <small>gangs submitted</small>
            </div>
            {secondsRemaining !== null && (
              <div className="gamerun-clock">
                <strong>{Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2, "0")}</strong>
                <small>remaining</small>
              </div>
            )}
          </div>
          <div className="gamerun-progress-track" role="progressbar" aria-label="Gang submissions" aria-valuemin={0} aria-valuemax={board.totalGangCount} aria-valuenow={board.submittedCount}>
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="gamerun-private-note">Action choices stay hidden until this phase resolves.</p>
        </section>
      )}

      {game.status === "finished" && (
        <section className="gamerun-winner board-panel">
          <p className="gamerun-eyebrow">Winner</p>
          <h2>{winner?.name ?? "No winner recorded"}</h2>
        </section>
      )}

      <div className="gamerun-columns">
        <section className="board-panel gamerun-gangs">
          <div className="gamerun-section-heading">
            <div>
              <p className="gamerun-eyebrow">Standings</p>
              <h2>Gangs</h2>
            </div>
            <span>{game.memberCount}/{game.maxPlayers} players</span>
          </div>
          <ul className="gamerun-gang-list">
            {board.gangs.map((gang) => (
              <li key={gang.id}>
                <img src={characterImageUrl(gang.characterId)} alt="" />
                <strong>{gang.name}</strong>
                <span>{gang.turfsHeld} Turfs</span>
                <span>${gang.money.toLocaleString()}</span>
                <span>{gang.members} members</span>
                <span>Notoriety {gang.notoriety}</span>
              </li>
            ))}
            {board.gangs.length === 0 && <li className="gamerun-empty">No gangs yet.</li>}
          </ul>
        </section>

        <section className="board-panel gamerun-turfs">
          <div className="gamerun-section-heading">
            <div>
              <p className="gamerun-eyebrow">Territory</p>
              <h2>Turfs</h2>
            </div>
            <span>{board.neutralTurfs} neutral</span>
          </div>
          <ul className="gamerun-turf-list">
            {board.turfs.map((turf) => {
              const owner = board.gangs.find((gang) => gang.id === turf.ownerGangId);
              return (
                <li key={turf.id} className={owner ? "is-owned" : "is-neutral"}>
                  <span>{turf.label}</span>
                  <strong className="turf-owner">
                    {owner && board.protectedGangIds.includes(owner.id) && (
                      <img className="protect-shield-icon" src="/protect-shield.png" alt="Defend active" />
                    )}
                    {owner?.name ?? "Neutral"}
                    {owner && <img className="gang-avatar" src={characterImageUrl(owner.characterId)} alt="" />}
                  </strong>
                </li>
              );
            })}
            {board.turfs.length === 0 && <li className="gamerun-empty">Turfs will appear when the game starts.</li>}
          </ul>
        </section>
      </div>

      <section className="board-panel gamerun-history">
        <div className="gamerun-section-heading">
          <div>
            <p className="gamerun-eyebrow">Resolved phases only</p>
            <h2>Match history</h2>
          </div>
        </div>
        {board.actionLog.length === 0 ? <p className="gamerun-empty">No resolved actions yet.</p> : (
          <ol>
            {board.actionLog.slice(0, 8).map((entry) => {
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
                  <strong>Round {entry.roundNumber} · {entry.phase}</strong>
                  <span>{entry.gangName} — {entry.action.replaceAll("_", " ")}{targetGangName ? ` targeting ${targetGangName}` : ""}{targetTurfName ? ` targeting ${targetTurfName}` : ""}</span>
                  <small>
                    Outcome: <ActionOutcome
                      outcome={entry.outcome}
                      highlightExpandResult={entry.phase === "phase2" && entry.action === "expand"}
                    />
                  </small>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}

function characterImageUrl(characterId: number): string {
  return `/characters/character_${String(characterId).padStart(2, "0")}.png`;
}
