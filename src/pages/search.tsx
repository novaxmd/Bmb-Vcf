import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import TopBar from "@/components/TopBar";

type ResultState = {
  checked: boolean;
  exists: boolean;
} | null;

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ResultState>(null);

  const handleCheck = async () => {
    setError("");
    setResult(null);

    const trimmed = query.trim();
    if (!trimmed) {
      setError("Enter a name or phone number to check.");
      return;
    }

    setChecking(true);
    try {
      const res = await fetch("/api/check-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
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
          Enter your name or phone number to see if you're already registered in the directory.
        </div>

        <div className="card">
          <input
            type="text"
            className="input-modern"
            placeholder="Your name or phone number"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
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
                <i className="fas fa-magnifying-glass" /> Search
              </>
            )}
          </button>

          {result && result.exists && (
            <div className="search-result search-result-success">
              <i className="fas fa-circle-check" />
              <div>
                <p className="search-result-title">Found — you're already registered!</p>
                <p className="search-result-subtitle">This name or number is part of the BMB VCF directory.</p>
              </div>
            </div>
          )}

          {result && !result.exists && (
            <div className="search-result search-result-info">
              <i className="fas fa-circle-info" />
              <div>
                <p className="search-result-title">Not found</p>
                <p className="search-result-subtitle">No match in the directory yet.</p>
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
