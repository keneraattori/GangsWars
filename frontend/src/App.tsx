import { Route, Routes, useLocation } from "react-router-dom";
import "./App.css";
import { AdminPage } from "./pages/AdminPage";
import { EntryPage } from "./pages/EntryPage";
import { GameboardPage } from "./pages/GameboardPage";
import { GamerunPage } from "./pages/GamerunPage";
import { useAuth } from "./state/auth-context";

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  return user ? <GameboardPage /> : <EntryPage />;
}

function App() {
  const pathname = useLocation().pathname;
  const isGamerun = pathname.startsWith("/gamerun/");
  const isAdmin = pathname.startsWith("/admin");

  return (
    <div className={isGamerun ? "app-shell app-shell-gamerun" : isAdmin ? "app-shell app-shell-admin" : "app-shell app-shell-player"}>
      <header className="site-banner">
        <img src="/banner.jpg" alt="Turf Wars" />
      </header>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/gamerun/:gameId" element={<GamerunPage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}

export default App;
