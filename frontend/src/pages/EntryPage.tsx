import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin } from "../api/admin";
import { useAuth } from "../state/auth-context";

export function EntryPage() {
  const { enter } = useAuth();
  const navigate = useNavigate();
  const [gangName, setGangName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);

  async function handleEnter(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await enter(gangName.trim());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not join the lobby");
    }
  }

  async function handleAdminLogin(event: FormEvent) {
    event.preventDefault();
    setAdminError(null);
    try {
      await adminLogin(adminUsername, adminPassword);
      navigate("/admin");
    } catch (reason) {
      setAdminError(reason instanceof Error ? reason.message : "Admin login failed");
    }
  }

  return (
    <main>
      <h1>Join the lobby</h1>
      <form onSubmit={(event) => void handleEnter(event)}>
        <label>
          Gang name
          <input value={gangName} onChange={(event) => setGangName(event.target.value)} minLength={3} maxLength={30} required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Join lobby</button>
      </form>

      <h2>Admin login</h2>
      <form onSubmit={(event) => void handleAdminLogin(event)}>
        <label>
          Username
          <input value={adminUsername} onChange={(event) => setAdminUsername(event.target.value)} autoComplete="username" required />
        </label>
        <label>
          Password
          <input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} autoComplete="current-password" required />
        </label>
        {adminError && <p role="alert">{adminError}</p>}
        <button type="submit">Log in as admin</button>
      </form>
    </main>
  );
}
