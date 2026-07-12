import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import TopBar from "@/components/TopBar";
import {
  saveAdminToken,
  getAdminToken,
  clearAdminToken,
  adminFetch,
  isAdminSession,
  getSessionRole,
  saveAdminUsername,
  getAdminUsername,
} from "@/lib/adminClient";
import type { Contact } from "@/types";

type AdminRow = {
  id: string | number;
  email: string;
  username: string | null;
  status: "pending" | "active";
  created_at?: string;
};

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [role, setRole] = useState<"owner" | "admin" | null>(null);
  const [loggedInUsername, setLoggedInUsername] = useState("");
  const [view, setView] = useState<"dashboard" | "contacts">("dashboard");
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

  // Owner-only: manage invited admins
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitingAdmin, setInvitingAdmin] = useState(false);
  const [adminBusyId, setAdminBusyId] = useState<string | number | null>(null);

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
      setRole(getSessionRole());
      setLoggedInUsername(getAdminUsername() || "");
      fetchContacts("");
      if (getSessionRole() === "owner") fetchAdmins();
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
        saveAdminUsername(username.trim());
        setUnlocked(true);
        const newRole = getSessionRole();
        setRole(newRole);
        setLoggedInUsername(username.trim());
        setUsername("");
        setPassword("");
        fetchContacts("");
        if (newRole === "owner") fetchAdmins();
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
    setRole(null);
    setAdmins([]);
    setLoggedInUsername("");
    setView("dashboard");
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

  // --- Owner-only: manage invited admins ---

  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const res = await adminFetch("/api/admin/admins-list");
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.admins)) {
        setAdmins(data.admins);
      }
    } catch (err) {
      console.error("fetchAdmins failed:", err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleInvite = async () => {
    const trimmed = inviteEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      showToast("Enter a valid email address.", "error");
      return;
    }
    setInvitingAdmin(true);
    try {
      const res = await adminFetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Invite sent to ${trimmed}.`, "success");
        setInviteEmail("");
        fetchAdmins();
      } else {
        showToast(data.error || "Failed to send invite.", "error");
      }
    } catch {
      showToast("Network error while sending invite.", "error");
    } finally {
      setInvitingAdmin(false);
    }
  };

  const handleRemoveAdmin = (admin: AdminRow) => {
    askConfirm(`Remove admin access for ${admin.email}? This cannot be undone.`, async () => {
      setConfirmModal(null);
      setAdminBusyId(admin.id);
      try {
        const res = await adminFetch("/api/admin/remove-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: admin.id }),
        });
        const data = await res.json();
        if (data.success) {
          setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
          showToast("Admin removed.", "success");
        } else {
          showToast(data.error || "Failed to remove admin.", "error");
        }
      } catch {
        showToast("Network error while removing admin.", "error");
      } finally {
        setAdminBusyId(null);
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
          <meta property="og:title" content="Admin Login · BMB VCF" />
          <meta property="og:image" content="https://bmb-vcf.zone.id/og-image.jpg" />
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
        <meta property="og:title" content="Command Center · BMB VCF" />
        <meta property="og:image" content="https://bmb-vcf.zone.id/og-image.jpg" />
      </Head>
      <div className="page">
        <TopBar title="BMB VCF" />

        {view === "contacts" ? (
          <>
            <div className="card-header">
              <button className="btn btn-ghost-purple" onClick={() => setView("dashboard")}>
                <i className="fas fa-arrow-left" /> Back
              </button>
              <div style={{ textAlign: "right" }}>
                <div className="section-title" style={{ marginBottom: 2, fontSize: "1.1rem" }}>
                  Registered Contacts
                </div>
                <div className="section-subtitle" style={{ marginBottom: 0 }}>
                  {contacts.length} total
                </div>
              </div>
            </div>

            <div className="card">
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
          </>
        ) : (
          <>
            <div className="card-header">
              <div>
                <div className="section-title" style={{ marginBottom: 2 }}>
                  Command Center
                </div>
                <div className="section-subtitle" style={{ marginBottom: 0 }}>
                  Welcome back, {loggedInUsername || (role === "owner" ? "owner" : "admin")}
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
                  {role === "owner" ? "Owner" : "Admin"}
                </div>
                <div className="stat-foot">session active</div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-label">Team</span>
              </div>

              {role === "owner" && (
                <div className="phone-row" style={{ marginBottom: 12 }}>
                  <input
                    type="email"
                    className="input-modern"
                    style={{ marginBottom: 0 }}
                    placeholder="Admin's Gmail address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ flex: "0 0 auto" }}
                    onClick={handleInvite}
                    disabled={invitingAdmin}
                  >
                    {invitingAdmin ? <span className="spinner" /> : <i className="fas fa-paper-plane" />}
                  </button>
                </div>
              )}

              <div className="roster-list">
                {/* Owner is always shown first, from the current session */}
                <div className="roster-item">
                  <div className="roster-row" style={{ cursor: "default" }}>
                    <span className="roster-info">
                      <span className="roster-name">
                        {role === "owner" ? loggedInUsername || "Owner" : "Owner"}{" "}
                        <span style={{ fontSize: "0.7rem", color: "var(--accent)", marginLeft: 6 }}>
                          OWNER
                        </span>
                      </span>
                      <span className="roster-phone">Full access</span>
                    </span>
                  </div>
                </div>

                {role === "owner" &&
                  (loadingAdmins ? (
                    <div className="section-subtitle" style={{ textAlign: "center", padding: "10px 0" }}>
                      <span className="spinner" /> Loading admins...
                    </div>
                  ) : (
                    admins.map((a) => (
                      <div className="roster-item" key={a.id}>
                        <div className="roster-row" style={{ cursor: "default" }}>
                          <span className="roster-info">
                            <span className="roster-name">
                              {a.username || "(pending setup)"}{" "}
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  color: a.status === "active" ? "var(--accent)" : "#e0b84c",
                                  marginLeft: 6,
                                }}
                              >
                                {a.status === "active" ? "ACTIVE" : "PENDING"}
                              </span>
                            </span>
                            <span className="roster-phone">{a.email}</span>
                          </span>
                          <button
                            className="btn btn-secondary"
                            style={{
                              flex: "0 0 auto",
                              borderColor: "#ff6b6b",
                              color: "#ff6b6b",
                              padding: "6px 10px",
                            }}
                            onClick={() => handleRemoveAdmin(a)}
                            disabled={adminBusyId === a.id}
                          >
                            {adminBusyId === a.id ? <span className="spinner" /> : <i className="fas fa-trash" />}
                          </button>
                        </div>
                      </div>
                    ))
                  ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-label">Contacts</span>
              </div>
              <button className="btn btn-primary btn-block" onClick={() => setView("contacts")}>
                <i className="fas fa-address-book" /> View Contacts
              </button>
              <div className="btn-group" style={{ marginTop: 10 }}>
                <button className="btn btn-secondary" onClick={() => handleDownload("vcf")}>
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
          </>
        )}

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
