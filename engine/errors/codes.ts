export const ERROR_CODES = {
  PR_EXTRACTION_FAILED: "PR_EXTRACTION_FAILED",
  GITHUB_API_RATE_LIMITED: "GITHUB_API_RATE_LIMITED",
  MODEL_TIMEOUT: "MODEL_TIMEOUT",
  INVALID_MODEL_OUTPUT: "INVALID_MODEL_OUTPUT",
  SCREENSHOT_LIMIT_REACHED: "SCREENSHOT_LIMIT_REACHED",
  SESSION_STORAGE_LIMIT_REACHED: "SESSION_STORAGE_LIMIT_REACHED",
  SETTINGS_VALIDATION_FAILED: "SETTINGS_VALIDATION_FAILED",
  WORKER_STATE_RESTORE_FAILED: "WORKER_STATE_RESTORE_FAILED"
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  PR_EXTRACTION_FAILED: "Could not extract pull request context from this page.",
  GITHUB_API_RATE_LIMITED: "GitHub API rate limit exceeded. Try again later or use a token.",
  MODEL_TIMEOUT: "Model request timed out. Retry or reduce scope.",
  INVALID_MODEL_OUTPUT: "Model response failed schema validation.",
  SCREENSHOT_LIMIT_REACHED: "Screenshot limit reached for this session; recording continues without images.",
  SESSION_STORAGE_LIMIT_REACHED: "Session storage limit reached; recording continues with reduced detail.",
  SETTINGS_VALIDATION_FAILED: "Settings are invalid. Fix errors and save before running analysis.",
  WORKER_STATE_RESTORE_FAILED: "Recorder state could not be restored after worker restart."
};
