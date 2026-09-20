import { Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { GameboardPage } from "./pages/GameboardPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

function App() {
  return (
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
  );
}

export default App;
