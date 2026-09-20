import { useAuth } from "../state/auth-context";

// Placeholder landing page; full Gameboard (round, gangs, turfs) lands at Roadmap milestone M3.
export function GameboardPage() {
  const { user, logout } = useAuth();

  return (
    <main>
      <h1>Gameboard</h1>
      <p>Welcome, {user?.username}.</p>
      <button type="button" onClick={() => void logout()}>
        Log out
      </button>
    </main>
  );
}
