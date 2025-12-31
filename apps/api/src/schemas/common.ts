import { t } from "elysia";

/** Standard error response */
export const ErrorResponse = t.Object({
  error: t.String(),
});

/** Standard success response */
export const SuccessResponse = t.Object({
  success: t.Boolean(),
});

/** Success with path response (for file operations) */
export const SuccessWithPathResponse = t.Object({
  success: t.Boolean(),
  path: t.String(),
});

/** Root API info response */
export const ApiInfoResponse = t.Object({
  message: t.String(),
  version: t.String(),
  docs: t.String(),
});

/** Health check response */
export const HealthResponse = t.Object({
  status: t.Literal("ok"),
  timestamp: t.String(),
});
