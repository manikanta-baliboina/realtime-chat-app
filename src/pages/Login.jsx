import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../services/firebase";
import {
  getFirebaseAuthMessage,
  normalizeEmail,
  validateLoginForm,
} from "../utils/auth";

const initialForm = {
  email: "",
  password: "",
};

const Login = () => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const navigate = useNavigate();

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setAuthMessage("");
    setResetMessage("");
  }

  async function handleLogin(event) {
    event.preventDefault();

    const nextErrors = validateLoginForm(form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setAuthMessage("");

    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );

      await signInWithEmailAndPassword(
        auth,
        normalizeEmail(form.email),
        form.password
      );

      navigate("/");
    } catch (error) {
      setAuthMessage(getFirebaseAuthMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    const nextErrors = validateLoginForm({ email: form.email, password: "filled" });

    if (nextErrors.email) {
      setErrors((current) => ({ ...current, email: nextErrors.email }));
      return;
    }

    setResetSending(true);
    setResetMessage("");
    setAuthMessage("");

    try {
      await sendPasswordResetEmail(auth, normalizeEmail(form.email));
      setResetMessage("Password reset email sent. Check your inbox.");
    } catch (error) {
      setAuthMessage(getFirebaseAuthMessage(error));
    } finally {
      setResetSending(false);
    }
  }

  return (
    <div className="container auth-layout">
      <section className="auth-hero">
        <p className="eyebrow">Secure access</p>
        <h1>Sign in to your conversations.</h1>
        <p>
          Keep your chat history, presence state, and group activity in sync across
          sessions with a more realistic authentication flow.
        </p>
        <div className="auth-hero__highlights">
          <span>Session persistence</span>
          <span>Password reset</span>
          <span>Inline validation</span>
        </div>
      </section>

      <div className="card auth-card">
        <div className="auth-card__header">
          <p className="eyebrow">Welcome back</p>
          <h2>Login</h2>
          <p>Use your account email to enter the real-time workspace.</p>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
            />
            {errors.email ? <small className="field-error">{errors.email}</small> : null}
          </label>

          <label className="field">
            <span>Password</span>
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password ? (
              <small className="field-error">{errors.password}</small>
            ) : null}
          </label>

          <div className="auth-form__row">
            <label className="check-row">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>Remember this device</span>
            </label>

            <button
              type="button"
              className="text-button"
              onClick={handlePasswordReset}
              disabled={resetSending}
            >
              {resetSending ? "Sending..." : "Forgot password?"}
            </button>
          </div>

          {authMessage ? <div className="auth-alert error">{authMessage}</div> : null}
          {resetMessage ? <div className="auth-alert success">{resetMessage}</div> : null}

          <button type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Login"}
          </button>
        </form>

        <div className="link">
          <span>Need an account? </span>
          <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
