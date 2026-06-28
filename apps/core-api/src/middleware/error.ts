/** Central error handling + a typed application error. */
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (_req: Request, res: Response) => {
  res.status(404).json({ error: { code: "not_found", message: "Resource not found." } });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: "validation_error",
        message: "Validation failed.",
        fields: err.flatten().fieldErrors,
      },
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  console.error("Unhandled error:", err);
  return res.status(500).json({
    error: { code: "internal_error", message: "Something went wrong on our end." },
  });
};
