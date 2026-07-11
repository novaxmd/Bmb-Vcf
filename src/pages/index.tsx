import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import TopBar from "@/components/TopBar";
import { countries } from "@/lib/countries";
import type { Country } from "@/types";

const TARGET = 500;

type ModalState = {
  open: boolean;
  icon: string;
  message: string;
  isError: boolean;
};

export default function HomePage() {
  const [count, setCount] = useState<number>(0);
  const [countrySearch, setCountrySearch] = useState("Tanzania");
  const [selectedCode, setSelectedCode] = useState("+255");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<ModalState>({
    open: false,
    icon: "fa-spinner fa-pulse",
    message: "",
    isError: false,
  });
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/count");
        const data = await res.json();
        if (typeof data.count === "number") setCount(data.count);
      } catch {
        // ignore transient errors, keep last known count
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const filteredCountries: Country[] = countries.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const percent = Math.min(100, (count / TARGET) * 100);

  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  const handleSubmit = async () => {
    if (!phone.trim()) {
      setModal({ open: true, icon: "fa-triangle-exclamation", message: "Please enter your phone number", isError: true });
      return;
    }

    setSubmitting(true);
    setModal({ open: true, icon: "fa-spinner fa-pulse", message: "Saving contact...", isError: false });

    try {
      const fullPhone = `${selectedCode}${phone.replace(/\D/g, "")}`;
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null, phone: fullPhone }),
      });
      const data = await res.json();

      if (data.exists) {
        setModal({ open: true, icon: "fa-circle-info", message: "This number is already registered.", isError: true });
      } else if (data.success) {
        setModal({ open: true, icon: "fa-circle-check", message: "Contact saved successfully!", isError: false });
        setPhone("");
        setName("");
      } else {
        setModal({ open: true, icon: "fa-circle-xmark", message: data.error || "Something went wrong.", isError: true });
      }
    } catch {
      setModal({ open: true, icon: "fa-circle-xmark", message: "Network error. Please try again.", isError: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>BMB VCF · Command Center</title>
      </Head>
      <div className="page">
        <TopBar title="BMB VCF" />

        <div className="section-title">Join the Directory</div>
        <div className="section-subtitle">Register your number to be added to the community VCF.</div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="live-badge">
              <span className="pulse-dot" />
              <span className="stat-label">Live</span>
            </div>
            <div className="stat-value">
              {count} <small>contacts</small>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Target</div>
            <div className="stat-value">
              {TARGET} <small>VCF</small>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="progress-area">
            <div className="progress-label">
              <span>
                <i className="fas fa-chart-line" /> Upload progress
              </span>
              <span>{Math.round(percent)}%</span>
            </div>
            <div className="bar-bg">
              <div className="bar-fill" style={{ width: `${percent}%` }} />
            </div>
          </div>

          <div className="target-message">
            <i className="fas fa-download" /> VCF download unlocks for admins at any time from the dashboard.
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <div ref={wrapperRef} className="phone-row">
              <div className="country-code-wrapper">
                <input
                  type="text"
                  className="input-modern"
                  placeholder="Country"
                  value={countrySearch}
                  onFocus={() => setDropdownOpen(true)}
                  onChange={(e) => {
                    setCountrySearch(e.target.value);
                    setDropdownOpen(true);
                  }}
                  autoComplete="off"
                />
                {dropdownOpen && (
                  <div className="country-dropdown">
                    {filteredCountries.length === 0 && (
                      <div style={{ color: "#8b7aa8" }}>No country found</div>
                    )}
                    {filteredCountries.map((c) => (
                      <div
                        key={c.name}
                        onClick={() => {
                          setSelectedCode(c.code);
                          setCountrySearch(c.name);
                          setDropdownOpen(false);
                        }}
                      >
                        {c.name} ({c.code})
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="tel"
                className="input-modern phone-number-input"
                placeholder={`Phone number (${selectedCode})`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="off"
              />
            </div>

            <input
              type="text"
              className="input-modern"
              placeholder="Full name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />

            <div className="btn-group">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <i className="fas fa-cloud-upload-alt" /> {submitting ? "Saving..." : "Save"}
              </button>
              <a
                href="https://chat.whatsapp.com/FmtTNDEE5YZ1tWJ4og1V0I"
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
              >
                <i className="fab fa-whatsapp" /> Group
              </a>
            </div>
          </form>

          <div className="social-row">
            <a
              href="https://whatsapp.com/channel/0029VbAvIKNBFLgRqn0dG31J"
              target="_blank"
              rel="noreferrer"
              className="social-item"
            >
              <i className="fab fa-whatsapp" /> Channel
            </a>
            <a
              href="https://www.youtube.com/@bmb-tech"
              target="_blank"
              rel="noreferrer"
              className="social-item"
            >
              <i className="fab fa-youtube" /> YouTube
            </a>
          </div>
          <hr />
          <div className="footer-light">BMB TECH · 2026</div>
        </div>
      </div>

      {modal.open && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">
              <i className={`fas ${modal.icon}`} />
            </div>
            <div className="modal-message">{modal.message}</div>
            <button className="modal-ok-btn" onClick={closeModal}>
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}
