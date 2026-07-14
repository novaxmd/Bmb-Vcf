import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import TopBar from "@/components/TopBar";

type ResultState = {
  checked: boolean;
  exists: boolean;
} | null;

export default function SearchPage() {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ResultState>(null);

  const handleCheck = async () => {
    setError("");
    setResult(null);

    const trimmed = phone.trim();
    if (!trimmed) {
      setError("Enter your phone number to check.");
      return;
    }

    setChecking(true);
    try {
      const res = await fetch("/api/check-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setResult({ checked: true, exists: !!data.exists });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <Head>
        <title>Check Registration · BMB VCF</title>
        <meta name="description" content="Check if your phone number is already registered in the BMB VCF directory." />
      </Head>
      <div className="page">
        <TopBar title="BMB VCF" />

        <div className="section-title">Check Your Status</div>
        <div className="section-subtitle">
          Enter your phone number to see if you're already registered in the directory.
        </div>

        <div className="card">
          <input
            type="tel"
            className="input-modern"
            placeholder="Phone number with country code (e.g. +255712345678)"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setResult(null);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleCheck()}
            autoComplete="off"
          />
          {error && <div className="error-text">{error}</div>}

          <button className="btn btn-primary btn-block" onClick={handleCheck} disabled={checking}>
            {checking ? (
              <>
                <span className="spinner" /> Checking...
              </>
            ) : (
              <>
                <i className="fas fa-magnifying-glass" /> Check Number
              </>
            )}
          </button>

          {result && result.exists && (
            <div className="search-result search-result-success">
              <i className="fas fa-circle-check" />
              <div>
                <p className="search-result-title">You're already registered!</p>
                <p className="search-result-subtitle">This number is part of the BMB VCF directory.</p>
              </div>
            </div>
          )}

          {result && !result.exists && (
            <div className="search-result search-result-info">
              <i className="fas fa-circle-info" />
              <div>
                <p className="search-result-title">Not registered yet</p>
                <p className="search-result-subtitle">This number hasn't joined the directory.</p>
              </div>
              <Link href="/" className="btn btn-primary search-result-cta">
                Register Now
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
