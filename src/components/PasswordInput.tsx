import { useState, InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export default function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input-wrap">
      <input {...props} type={visible ? "text" : "password"} className={`input-modern ${props.className || ""}`} />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        <i className={`fas ${visible ? "fa-eye-slash" : "fa-eye"}`} />
      </button>
    </div>
  );
}
