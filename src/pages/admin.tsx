import { useEffect, useState } from "react";
import Head from "next/head";
import TopBar from "@/components/TopBar";
import {
  saveAdminToken,
  getAdminToken,
  clearAdminToken,
  adminFetch,
  isAdminSession,
} from "@/lib/adminClient";
import type { Contact } from "@/types";

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isAdminSession()) {
      setUnlocked(true);
      loadContacts();
    }
    setCheckingSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadContacts = async () => {
    setLoadingList(true);
    setListError("");
    try {
      const res = await adminFetch("/api/admin/list");
      if (res.status === 401) {
        clearAdminToken();
        setUnlocked(false);
        return;
      }
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch {
      setListError("Failed to load registered contacts.");
    } finally {
      setLoadingList(false);
    }
  };

  const handleLogin = async () => {
    if (!password) {
      setLoginError("Enter the admin password.");
      return;
    }
    setLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        saveAdminToken(data.token);
        setUnlocked(true);
        setPassword("");
        loadContacts();
      } else {
        setLoginError(data.error || "Incorrect password.");
      }
    } catch {
      setLoginError("Network error. Try again.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    setUnlocked(false);
    setContacts([]);
  };

  const handleDownload = async (kind: "vcf" | "pdf") => {
    const token = getAdminToken();
    const url = kind === "vcf" ? "/api/admin/download-vcf" : "/api/admin/download-pdf";
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Download failed" }));
        alert(data.error || "Download failed");
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = kind === "vcf" ? "contacts.vcf" : "contacts.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      alert("Download failed. Please try again.");
    }
  };

  const handleSearch = async () => {
    if (!search.trim()) {
      loadContacts();
      return;
    }
    setLoadingList(true);
    try {
      const res = await adminFetch("/api/admin/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: search.trim() }),
      });
      const data = await res.json();
      setContacts(Array.isArray(data) ? data : []);
    } catch {
      setListError("Search failed.");
    } finally {
      setLoadingList(false);
    }
  };

  if (checkingSession) {
    return null;
  }

  if (!unlocked) {
    return (
      <>
        <Head>
          <title>Admin Login · BMB VCF</title>
        </Head>
        <div className="page">
          <TopBar title="BMB VCF" />
          <div className="card admin-lock-panel">
            <div className="admin-lock-icon">
              <i className="fas fa-lock" />
            </div>
            <div className="section-title" style={{ fontSize: "1.3rem" }}>
              Admin Access
            </div>
            <div className="section-subtitle">
              Enter the admin password to unlock downloads and the registered list.
            </div>
            <input
              type="password"
              className="input-modern"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoFocus
            />
            {loginError && <div className="error-text">{loginError}</div>}
            <button
              className="btn btn-primary btn-block"
              onClick={handleLogin}
              disabled={loggingIn}
            >
              {loggingIn ? (
                <>
                  <span className="spinner" /> Verifying...
                </>
              ) : (
                <>
                  <i className="fas fa-unlock" /> Unlock
                </>
              )}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Command Center · BMB VCF</title>
      </Head>
      <div className="page">
        <TopBar title="BMB VCF" />

        <div className="card-header">
          <div>
            <div className="section-title" style={{ marginBottom: 2 }}>
              Command Center
            </div>
            <div className="section-subtitle" style={{ marginBottom: 0 }}>
              Welcome back, admin
            </div>
          </div>
          <button className="btn btn-ghost-purple" onClick={handleLogout}>
            <i className="fas fa-right-from-bracket" /> Logout
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <i className="fas fa-address-book" />
            </div>
            <div className="stat-label">Total Registered</div>
            <div className="stat-value">{contacts.length}</div>
            <div className="stat-foot">contacts in directory</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <i className="fas fa-shield-halved" />
            </div>
            <div className="stat-label">Access</div>
            <div className="stat-value" style={{ fontSize: "1.2rem" }}>
              Admin
            </div>
            <div className="stat-foot">session active</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-label">Exports</span>
          </div>
          <div className="btn-group">
            <button className="btn btn-primary" onClick={() => handleDownload("vcf")}>
              <i className="fas fa-file-arrow-down" /> Download VCF
            </button>
            <button className="btn btn-secondary" onClick={() => handleDownload("pdf")}>
              <i className="fas fa-file-pdf" /> Download PDF
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-label">Registered Contacts</span>
          </div>
          <div className="phone-row" style={{ marginBottom: 12 }}>
            <input
              type="text"
              className="input-modern"
              style={{ marginBottom: 0 }}
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button className="btn btn-secondary" onClick={handleSearch} style={{ flex: "0 0 auto" }}>
              <i className="fas fa-magnifying-glass" />
            </button>
          </div>

          {listError && <div className="error-text">{listError}</div>}

          {loadingList ? (
            <div className="section-subtitle" style={{ textAlign: "center" }}>
              <span className="spinner" /> Loading...
            </div>
          ) : contacts.length === 0 ? (
            <div className="section-subtitle" style={{ textAlign: "center" }}>
              No contacts found.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="roster">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c, i) => (
                    <tr key={c.id || c.phone}>
                      <td>{i + 1}</td>
                      <td>{c.name || "—"}</td>
                      <td>{c.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
