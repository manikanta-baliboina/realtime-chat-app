export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function validateLoginForm({ email, password }) {
  const errors = {};

  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!EMAIL_PATTERN.test(normalizeEmail(email))) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  }

  return errors;
}

export function validateRegisterForm({
  fullName,
  email,
  password,
  confirmPassword,
}) {
  const errors = {};

  if (!fullName.trim()) {
    errors.fullName = "Full name is required.";
  } else if (fullName.trim().length < 3) {
    errors.fullName = "Use at least 3 characters.";
  }

  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!EMAIL_PATTERN.test(normalizeEmail(email))) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Use at least 8 characters.";
  } else if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = "Include one uppercase letter and one number.";
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Confirm your password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

export function getFirebaseAuthMessage(error) {
  const code = error?.code || "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    case "auth/email-already-in-use":
      return "An account already exists with that email.";
    case "auth/weak-password":
      return "Choose a stronger password.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/missing-email":
      return "Enter your email address.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    default:
      return error?.message || "Authentication failed. Please try again.";
  }
}

export function createAvatarSeed(name) {
  return name
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2);
}
