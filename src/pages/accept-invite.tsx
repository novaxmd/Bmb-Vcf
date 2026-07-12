import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import TopBar from "@/components/TopBar";

export default function AcceptInvitePage() {
  const router = useRouter();
  const { token } = router.query;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!token || typeof token !== "string") {
      setError("This invite link is missing its token.");
      return;
    }
    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username: username.trim(), password }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Set Up Admin Account · BMB VCF</title>
      </Head>
      <div className="page">
        <TopBar title="BMB VCF" />

        <div className="card admin-lock-panel">
          <div className="admin-lock-icon">
            <i className="fas fa-user-shield" />
          </div>

          {done ? (
            <>
              <div className="section-title" style={{ fontSize: "1.3rem" }}>
                Account Ready
              </div>
              <div className="section-subtitle">
                Your admin account has been set up. You can now log in from the admin page.
              </div>
              <button className="btn btn-primary btn-block" onClick={() => router.push("/admin")}>
                <i className="fas fa-right-to-bracket" /> Go to Admin Login
              </button>
            </>
          ) : (
            <>
              <div className="section-title" style={{ fontSize: "1.3rem" }}>
                Set Up Your Admin Account
              </div>
              <div className="section-subtitle">
                Choose a username and password to access the BMB VCF admin dashboard.
              </div>
              <input
                type="text"
                className="input-modern"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
              />
              <input
                type="password"
                className="input-modern"
                placeholder="Choose a password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <input
                type="password"
                className="input-modern"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              {error && <div className="error-text">{error}</div>}
              <button className="btn btn-primary btn-block" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="spinner" /> Setting up...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check" /> Create Account
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
