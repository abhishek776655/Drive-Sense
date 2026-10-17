/** Same rules as the server (profile_service): 3–20 of a–z, 0–9 and _, stored lowercase. */
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

export const normalizeHandle = (raw: string): string => raw.trim().replace(/^@+/, '').trim().toLowerCase();

/** Why a normalised handle cannot be used, or null; checked before asking the server. */
export const handleProblem = (handle: string): string | null => {
  if (handle.length < HANDLE_MIN) {
    return `At least ${HANDLE_MIN} characters`;
  }
  if (handle.length > HANDLE_MAX) {
    return `At most ${HANDLE_MAX} characters`;
  }
  if (!/^[a-z0-9_]+$/.test(handle)) {
    return 'Letters, numbers and _ only';
  }
  return null;
};
