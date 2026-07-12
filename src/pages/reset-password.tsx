import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import TopBar from "@/components/TopBar";
import PasswordInput from "@/components/PasswordInput";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = router.query;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!token || typeof token !== "string") {
      setError("This reset link is missing its token.");
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
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
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
        <title>Reset Password · BMB VCF</title>
      </Head>
      <div className="page">
        <TopBar title="BMB VCF" />

        <div className="card admin-lock-panel">
          <div className="admin-lock-icon">
            <i className="fas fa-key" />
          </div>

          {done ? (
            <>
              <div className="section-title" style={{ fontSize: "1.3rem" }}>
                Password Updated
              </div>
              <div className="section-subtitle">
                Your password has been reset. You can now log in with your new password.
              </div>
              <button className="btn btn-primary btn-block" onClick={() => router.push("/admin")}>
                <i className="fas fa-right-to-bracket" /> Go to Admin Login
              </button>
            </>
          ) : (
            <>
              <div className="section-title" style={{ fontSize: "1.3rem" }}>
                Reset Your Password
              </div>
              <div className="section-subtitle">
                Choose a new password for your BMB VCF admin account.
              </div>
              <PasswordInput
                placeholder="New password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <PasswordInput
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              {error && <div className="error-text">{error}</div>}
              <button className="btn btn-primary btn-block" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="spinner" /> Resetting...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check" /> Reset Password
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
