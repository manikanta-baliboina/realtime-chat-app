import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import {
  createAvatarSeed,
  getFirebaseAuthMessage,
  normalizeEmail,
  validateRegisterForm,
} from "../utils/auth";

const initialForm = {
  fullName: "",
  gender: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const Register = () => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setAuthMessage("");
  }

  async function handleRegister(event) {
    event.preventDefault();

    const nextErrors = {
      ...validateRegisterForm(form),
      ...(form.gender ? {} : { gender: "Select a gender option." }),
    };

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setAuthMessage("");
    setSuccessMessage("");

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        normalizeEmail(form.email),
        form.password
      );

      const user = userCredential.user;
      const trimmedName = form.fullName.trim();

      await updateProfile(user, {
        displayName: trimmedName,
      });

      await setDoc(
        doc(db, "users", user.uid),
        {
          fullName: trimmedName,
          displayName: trimmedName,
          gender: form.gender,
          email: normalizeEmail(form.email),
          avatarSeed: createAvatarSeed(trimmedName),
          online: true,
          lastSeen: serverTimestamp(),
          createdAt: serverTimestamp(),
          authProvider: "password",
        },
        { merge: true }
      );

      await sendEmailVerification(user);

      setSuccessMessage("Account created. Verification email sent.");
      navigate("/");
    } catch (error) {
      setAuthMessage(getFirebaseAuthMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container auth-layout">
      <section className="auth-hero">
        <p className="eyebrow">Account setup</p>
        <h1>Create a chat profile people can recognize.</h1>
        <p>
          Real chat products need more than email and password. This flow creates a
          cleaner identity record for presence, group lists, and conversation previews.
        </p>
        <div className="auth-hero__highlights">
          <span>Profile metadata</span>
          <span>Strong password rules</span>
          <span>Email verification</span>
        </div>
      </section>

      <div className="card auth-card">
        <div className="auth-card__header">
          <p className="eyebrow">New account</p>
          <h2>Register</h2>
          <p>Set up your identity before joining the workspace.</p>
        </div>

        <form className="auth-form" onSubmit={handleRegister}>
          <label className="field">
            <span>Full name</span>
            <input
              type="text"
              placeholder="Your full name"
              value={form.fullName}
              onChange={(event) => updateField("fullName", event.target.value)}
            />
            {errors.fullName ? (
              <small className="field-error">{errors.fullName}</small>
            ) : null}
          </label>

          <label className="field">
            <span>Gender</span>
            <select
              value={form.gender}
              onChange={(event) => updateField("gender", event.target.value)}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
            {errors.gender ? <small className="field-error">{errors.gender}</small> : null}
          </label>

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
                placeholder="At least 8 characters"
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
            <small className="field-hint">
              Use at least 8 characters with one uppercase letter and one number.
            </small>
            {errors.password ? (
              <small className="field-error">{errors.password}</small>
            ) : null}
          </label>

          <label className="field">
            <span>Confirm password</span>
            <div className="password-field">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repeat your password"
                value={form.confirmPassword}
                onChange={(event) =>
                  updateField("confirmPassword", event.target.value)
                }
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword((value) => !value)}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.confirmPassword ? (
              <small className="field-error">{errors.confirmPassword}</small>
            ) : null}
          </label>

          {authMessage ? <div className="auth-alert error">{authMessage}</div> : null}
          {successMessage ? (
            <div className="auth-alert success">{successMessage}</div>
          ) : null}

          <button type="submit" disabled={submitting}>
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="link">
          <span>Already registered? </span>
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
