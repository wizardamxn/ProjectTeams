// Throw these from anywhere in a request; the error middleware turns them into
// `{ message }` JSON with the right status. Anything else becomes a 500.
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message = "Bad request", code?: string) => new AppError(400, message, code);
export const unauthorized = (message = "Not authenticated") => new AppError(401, message, "unauthorized");
export const forbidden = (message = "Not allowed") => new AppError(403, message, "forbidden");
export const notFound = (message = "Not found") => new AppError(404, message, "not_found");
export const conflict = (message: string) => new AppError(409, message, "conflict");
export const tooLarge = (message: string) => new AppError(413, message, "too_large");
export const unsupported = (message: string) => new AppError(415, message, "unsupported_media_type");
