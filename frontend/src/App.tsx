import { Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { GameboardPage } from "./pages/GameboardPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

function App() {
  return (
    <>
      <header className="site-banner">
        <img src="/banner.jpg" alt="Turf Wars" />
      </header>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <GameboardPage />
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}

export default App;
