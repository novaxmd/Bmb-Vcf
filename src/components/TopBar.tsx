import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { isAdminSession } from "@/lib/adminClient";

interface TopBarProps {
  title?: string;
}

export default function TopBar({ title = "BMB VCF" }: TopBarProps) {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    setUnlocked(isAdminSession());
  }, []);

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="brand-badge">
          <img src="/logo.png" alt="BMB Logo" />
        </div>
        <span className="brand-title">{title}</span>
      </div>

      <div className="topbar-right">
        <a href="/" className="icon-btn" title="Home">
          <i className="fas fa-house" />
        </a>
        <button
          type="button"
          className="profile-btn"
          title={unlocked ? "Admin unlocked — open dashboard" : "Admin login"}
          onClick={() => router.push("/admin")}
        >
          <i className="fas fa-user" style={{ fontSize: "0.95rem" }} />
          <span className={`status-dot ${unlocked ? "unlocked" : "locked"}`} />
        </button>
      </div>
    </div>
  );
}
