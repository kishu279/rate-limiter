import type { Response, NextFunction, Request } from "express";
import { createLogger } from "./logger";

const log = createLogger("http");

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ErrorResponse {
  success: false;
  error: ErrorDetail;
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const body: ErrorResponse = {
    success: false,
    error: { code, message, details },
  };
  res.status(statusCode).json(body);
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ──────────────────────────────────────────
// Global Express Error Handler
// ──────────────────────────────────────────

export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  console.error("Unhandled error:", err);
  sendError(res, 500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred");
}

// ──────────────────────────────────────────
// 404 Handler
// ──────────────────────────────────────────

export function notFoundHandler(req: Request, res: Response): void {
  log.warn("route not found", {
    method: req.method,
    path: req.originalUrl,
    contentType: req.get("content-type"),
  });
  sendError(res, 404, "NOT_FOUND", "The requested resource was not found");
}
