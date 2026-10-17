/** Mirrors the backend's `RegisterRequest` minimum, so the server never rejects on length alone. */
export const MIN_PASSWORD_LENGTH = 8;

export type AuthFieldErrors = {identifier?: string; email?: string; password?: string; confirmPassword?: string};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateLogin = ({identifier, password}: {identifier: string; password: string}): AuthFieldErrors => {
  const errors: AuthFieldErrors = {};
  if (!identifier.trim()) {
    errors.identifier = 'Enter your username or email.';
  }
  if (!password) {
    errors.password = 'Enter your password.';
  }
  return errors;
};

/** Ported from mobile-expo's `validateRegistration`, unchanged in behaviour. */
export const validateRegistration = ({
  email,
  password,
  confirmPassword,
}: {
  email: string;
  password: string;
  confirmPassword: string;
}): AuthFieldErrors => {
  const errors: AuthFieldErrors = {};
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    errors.email = 'Enter your email address.';
  } else if (!EMAIL.test(trimmedEmail)) {
    errors.email = 'That does not look like an email address.';
  }
  if (!password) {
    errors.password = 'Choose a password.';
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  // Only complain about the confirmation once there is a password worth matching.
  if (password && confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  return errors;
};

/** Sign-up's optional email: empty is fine, anything typed must look like an address. */
export const emailProblem = (email: string): string | null => {
  const trimmed = email.trim();
  return trimmed && !EMAIL.test(trimmed) ? 'That does not look like an email address.' : null;
};

export const passwordProblem = (password: string): string | null =>
  password.length < MIN_PASSWORD_LENGTH ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : null;
