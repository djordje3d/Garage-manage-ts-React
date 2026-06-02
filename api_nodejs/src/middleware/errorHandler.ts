import { NextFunction, Request, Response } from "express";
import { ApiError, buildErrorPayload, isApiError } from "../errors";

type LegacyFieldError = { field: string; message: string };

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(
    buildErrorPayload("NOT_FOUND", `Cannot ${req.method} ${req.path}`, null)
  );
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (isApiError(err)) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  if (err instanceof SyntaxError && "body" in err) {
    res.status(422).json(
      buildErrorPayload("VALIDATION_ERROR", "Request validation failed.", {
        fields: [{ field: "body", message: "Invalid JSON" }]
      })
    );
    return;
  }

  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json(
    buildErrorPayload(
      "INTERNAL_SERVER_ERROR",
      "An unexpected server error occurred.",
      null
    )
  );
}

export function sendValidationError(res: Response, fields: LegacyFieldError[]): void {
  res.status(422).json(
    buildErrorPayload("VALIDATION_ERROR", "Request validation failed.", { fields })
  );
}

export function assertBody<T>(
  value: T | undefined,
  message: string,
  field = "body"
): asserts value is T {
  if (value === undefined || value === null) {
    throw new ApiError(422, "VALIDATION_ERROR", "Request validation failed.", {
      fields: [{ field, message }]
    });
  }
}
