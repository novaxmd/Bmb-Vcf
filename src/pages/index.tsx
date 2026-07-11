import { useEffect, useState } from "react";
import Head from "next/head";
import TopBar from "@/components/TopBar";
import SplashScreen from "@/components/SplashScreen";
import { countries } from "@/lib/countries";

const TARGET = 500;

type ModalState = {
  open: boolean;
  icon: string;
  message: string;
  isError: boolean;
};

export default function HomePage() {
  const [showSplash, setShowSplash] = useState(true);
  const [count, setCount] = useState<number>(0);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<ModalState>({
    open: false,
    icon: "fa-spinner fa-pulse",
    message: "",
    isError: false,
  });

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

  // Sorted list of known country dial codes (longest first) so we can match
  // "255...", "+255...", "1-242..." etc. against the correct country.
  const sortedCodes = [...countries]
    .map((c) => c.code.replace(/\D/g, "")) // digits only, e.g. "1242", "255"
    .filter((code, idx, arr) => arr.indexOf(code) === idx)
    .sort((a, b) => b.length - a.length);

  const MIN_LOCAL_DIGITS = 7; // minimum digits expected after the country code

  const validatePhone = (value: string, strict = false): string => {
    const trimmed = value.trim();
    if (!trimmed) return "Please enter your phone number";

    const hasPlus = trimmed.startsWith("+");
    const digitsOnly = trimmed.replace(/\D/g, "");

    if (!hasPlus && !/^\d/.test(trimmed)) {
      return "Start with your country code, e.g. +255 or 255";
    }

    // Wait until at least 3 digits are typed before flagging an unknown
    // code — this gives the user room to finish typing their country code
    // (e.g. "+2", "+25" are incomplete, not wrong) before we judge it.
    if (!strict && digitsOnly.length < 3) return "";

    const matchedCode = sortedCodes.find((code) => digitsOnly.startsWith(code));
    if (!matchedCode) {
      return "Start with your country code, e.g. +255 or 255";
    }

    const localDigits = digitsOnly.slice(matchedCode.length);
    if (strict && localDigits.length < MIN_LOCAL_DIGITS) {
      return "Phone number looks incomplete. Please enter the full number.";
    }

    return "";
  };

  const percent = Math.min(100, (count / TARGET) * 100);

  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  const handleSubmit = async () => {
    const validationError = validatePhone(phone, true);
    if (validationError) {
      setPhoneError(validationError);
      setModal({ open: true, icon: "fa-triangle-exclamation", message: validationError, isError: true });
      return;
    }
    setPhoneError("");

    setSubmitting(true);
    setModal({ open: true, icon: "fa-spinner fa-pulse", message: "Saving contact...", isError: false });

    try {
      const digitsOnly = phone.trim().replace(/\D/g, "");
      const fullPhone = `+${digitsOnly}`;
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
        <title>BMB VCF · Join the Directory</title>
        <meta name="description" content="Register your number to be added to the community VCF." />
        <meta property="og:title" content="BMB VCF · Join the Directory" />
        <meta property="og:description" content="Register your number to be added to the community VCF." />
        <meta property="og:image" content="https://bmb-vcf.zone.id/bmbtech.png" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://bmb-vcf.zone.id" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="BMB VCF · Join the Directory" />
        <meta name="twitter:description" content="Register your number to be added to the community VCF." />
        <meta name="twitter:image" content="https://bmb-vcf.zone.id/bmbtech.png" />
      </Head>
      {showSplash && <SplashScreen onGetStarted={() => setShowSplash(false)} />}
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
            <input
              type="tel"
              className="input-modern"
              placeholder="Phone number with country code (e.g. +255712345678)"
              value={phone}
              onChange={(e) => {
                const value = e.target.value;
                setPhone(value);
                if (value.trim()) {
                  setPhoneError(validatePhone(value));
                } else {
                  setPhoneError("");
                }
              }}
              autoComplete="off"
            />
            {phoneError && <div className="error-text">{phoneError}</div>}

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
