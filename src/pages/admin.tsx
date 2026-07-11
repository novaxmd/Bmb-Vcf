import { useEffect, useRef, useState } from "react";
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");

  // Which row is expanded to show edit/delete actions
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [rowBusyId, setRowBusyId] = useState<string | number | null>(null);
  const [dedupeRunning, setDedupeRunning] = useState(false);

  // Guards against stale/overlapping requests (list or search) leaving the
  // UI stuck on "Loading..." or showing outdated results.
  const requestId = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // In-app notifications (replaces browser alert()/confirm())
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showToast = (message: string, kind: "success" | "error" = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, kind });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const askConfirm = (message: string, onConfirm: () => void) => {
    setConfirmModal({ message, onConfirm });
  };

  useEffect(() => {
    if (isAdminSession()) {
      setUnlocked(true);
      fetchContacts("");
    }
    setCheckingSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unified loader: empty query -> full list, otherwise -> search.
  // Every call gets an id; only the latest one is allowed to update state,
  // so a slow earlier request can never overwrite a newer result or leave
  // loadingList stuck at true.
  const fetchContacts = async (query: string) => {
    const myId = ++requestId.current;
    setLoadingList(true);
    setListError("");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const trimmed = query.trim();
      const res = trimmed
        ? await adminFetch("/api/admin/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: trimmed }),
            signal: controller.signal,
          })
        : await adminFetch("/api/admin/list", { signal: controller.signal });

      if (myId !== requestId.current) return; // superseded by a newer request

      if (res.status === 401) {
        clearAdminToken();
        setUnlocked(false);
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setListError(errData.error || `Failed to load contacts (status ${res.status}).`);
        setContacts([]);
        return;
      }
      const data = await res.json().catch(() => null);
      if (trimmed) {
        // /api/admin/search returns a bare array
        if (Array.isArray(data)) {
          setContacts(data);
        } else {
          setListError((data && data.error) || "Search failed.");
          setContacts([]);
        }
      } else {
        // /api/admin/list returns { contacts: [...] }
        if (data && Array.isArray(data.contacts)) {
          setContacts(data.contacts);
        } else {
          setListError("Unexpected response from server while loading contacts.");
          setContacts([]);
        }
      }
    } catch (err) {
      if (myId !== requestId.current) return;
      console.error("fetchContacts failed:", err);
      if (err instanceof Error && err.name === "AbortError") {
        setListError("Loading timed out. Check your connection and try again.");
      } else {
        setListError("Failed to load contacts. Check your connection and try again.");
      }
      setContacts([]);
    } finally {
      clearTimeout(timeoutId);
      if (myId === requestId.current) setLoadingList(false);
    }
  };

  // Debounced search-as-you-type (400ms after the user stops typing)
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchContacts(value);
    }, 400);
  };

  const clearSearch = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setSearch("");
    fetchContacts("");
  };

  const handleLogin = async () => {
    if (!username.trim()) {
      setLoginError("Enter the admin username.");
      return;
    }
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
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        saveAdminToken(data.token);
        setUnlocked(true);
        setUsername("");
        setPassword("");
        fetchContacts("");
      } else {
        setLoginError(data.error || "Incorrect username or password.");
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
        showToast(data.error || "Download failed", "error");
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
      showToast("Download failed. Please try again.", "error");
    }
  };

  const toggleExpand = (c: Contact) => {
    const rowId = c.id ?? c.phone;
    if (expandedId === rowId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(rowId);
    setEditName(c.name || "");
    setEditPhone(c.phone || "");
  };

  const saveEdit = async (id: string | number) => {
    setRowBusyId(id);
    try {
      const res = await adminFetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName.trim(), phone: editPhone.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setContacts((prev) =>
          prev.map((c) => (c.id === id ? { ...c, name: editName.trim(), phone: editPhone.trim() } : c))
        );
        setExpandedId(null);
        showToast("Contact updated.", "success");
      } else {
        showToast(data.error || "Failed to update contact.", "error");
      }
    } catch {
      showToast("Network error while updating contact.", "error");
    } finally {
      setRowBusyId(null);
    }
  };

  const handleDelete = (id: string | number) => {
    askConfirm("Delete this contact? This cannot be undone.", async () => {
      setConfirmModal(null);
      setRowBusyId(id);
      try {
        const res = await adminFetch("/api/admin/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = await res.json();
        if (data.success) {
          setContacts((prev) => prev.filter((c) => c.id !== id));
          setExpandedId(null);
          showToast("Contact deleted.", "success");
        } else {
          showToast(data.error || "Failed to delete contact.", "error");
        }
      } catch {
        showToast("Network error while deleting contact.", "error");
      } finally {
        setRowBusyId(null);
      }
    });
  };

  const handleDedupe = () => {
    askConfirm("Remove all repeated phone numbers, keeping the earliest entry for each?", async () => {
      setConfirmModal(null);
      setDedupeRunning(true);
      try {
        const res = await adminFetch("/api/admin/dedupe", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          showToast(`Removed ${data.removed} duplicate contact(s).`, "success");
          fetchContacts(search);
        } else {
          showToast(data.error || "Failed to remove duplicates.", "error");
        }
      } catch {
        showToast("Network error while removing duplicates.", "error");
      } finally {
        setDedupeRunning(false);
      }
    });
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
              type="text"
              className="input-modern"
              placeholder="Admin username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoFocus
              autoComplete="off"
            />
            <input
              type="password"
              className="input-modern"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
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
          <div className="btn-group" style={{ marginTop: 10 }}>
            <button
              className="btn btn-ghost-purple btn-block"
              onClick={handleDedupe}
              disabled={dedupeRunning}
            >
              {dedupeRunning ? (
                <>
                  <span className="spinner" /> Removing duplicates...
                </>
              ) : (
                <>
                  <i className="fas fa-broom" /> Remove Duplicate Numbers
                </>
              )}
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
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {search.trim() !== "" && (
              <button
                className="btn btn-ghost-purple"
                style={{ flex: "0 0 auto" }}
                onClick={clearSearch}
                title="Clear search and show all"
              >
                <i className="fas fa-xmark" />
              </button>
            )}
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
            <div className="roster-list">
              {contacts.map((c, i) => {
                const rowId = c.id ?? c.phone;
                const isExpanded = expandedId === rowId;
                const isBusy = rowBusyId !== null && rowBusyId === c.id;
                return (
                  <div className="roster-item" key={rowId}>
                    <button
                      type="button"
                      className="roster-row"
                      onClick={() => toggleExpand(c)}
                    >
                      <span className="roster-index">{i + 1}</span>
                      <span className="roster-info">
                        <span className="roster-name">{c.name || "—"}</span>
                        <span className="roster-phone">{c.phone}</span>
                      </span>
                      <i className={`fas fa-chevron-${isExpanded ? "up" : "down"}`} />
                    </button>

                    {isExpanded && (
                      <div className="roster-details">
                        <input
                          type="text"
                          className="input-modern"
                          placeholder="Name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                        <input
                          type="text"
                          className="input-modern"
                          placeholder="Phone"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                        />
                        <div className="btn-group">
                          <button
                            className="btn btn-primary"
                            onClick={() => c.id !== undefined && saveEdit(c.id)}
                            disabled={isBusy}
                          >
                            {isBusy ? <span className="spinner" /> : <i className="fas fa-check" />} Save
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ borderColor: "#ff6b6b", color: "#ff6b6b" }}
                            onClick={() => c.id !== undefined && handleDelete(c.id)}
                            disabled={isBusy}
                          >
                            {isBusy ? <span className="spinner" /> : <i className="fas fa-trash" />} Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {toast && (
          <div className={`app-toast app-toast-${toast.kind}`}>
            <i className={`fas ${toast.kind === "success" ? "fa-circle-check" : "fa-circle-exclamation"}`} />
            <span>{toast.message}</span>
          </div>
        )}

        {confirmModal && (
          <div className="app-modal-overlay" onClick={() => setConfirmModal(null)}>
            <div className="app-modal" onClick={(e) => e.stopPropagation()}>
              <div className="app-modal-icon">
                <i className="fas fa-triangle-exclamation" />
              </div>
              <div className="app-modal-message">{confirmModal.message}</div>
              <div className="btn-group">
                <button
                  className="btn btn-secondary btn-block"
                  onClick={() => setConfirmModal(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-block"
                  style={{ background: "#ff6b6b", borderColor: "#ff6b6b" }}
                  onClick={() => confirmModal.onConfirm()}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
