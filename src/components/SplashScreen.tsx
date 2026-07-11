import { useEffect, useState } from "react";

const LOGO_DURATION_MS = 3000; // logo + spinner shown for 3s
const TYPE_TEXT = "Welcome to the website to increase vcf contact views";
const TYPE_DURATION_MS = 5000; // full sentence types out over 5s

type Props = {
  onGetStarted: () => void;
};

export default function SplashScreen({ onGetStarted }: Props) {
  // phase: "logo" -> spinner+logo only, "text" -> typing message + button
  const [phase, setPhase] = useState<"logo" | "text">("logo");
  const [typedText, setTypedText] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setPhase("text"), LOGO_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "text") return;
    const intervalMs = TYPE_DURATION_MS / TYPE_TEXT.length;
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setTypedText(TYPE_TEXT.slice(0, i));
      if (i >= TYPE_TEXT.length) clearInterval(interval);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [phase]);

  return (
    <div className="splash-screen">
      <div className="splash-logo-wrap">
        <div className={`splash-spinner ${phase === "text" ? "splash-spinner-stopped" : ""}`} />
        <img src="/logo.png" alt="BMB VCF" className="splash-logo" />
      </div>

      {phase === "text" && (
        <div className="splash-text-area">
          <div className="splash-message">
            {typedText}
            <span className="splash-caret" />
          </div>
          {typedText.length === TYPE_TEXT.length && (
            <button className="btn btn-primary splash-get-started" onClick={onGetStarted}>
              Get Started
            </button>
          )}
        </div>
      )}
    </div>
  );
}
