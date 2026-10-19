export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const badRequest = (message, code = 'BAD_REQUEST') => new HttpError(400, code, message);
export const forbidden = (message = 'Not allowed', code = 'FORBIDDEN', extra) => new HttpError(403, code, message, extra);
export const notFound = (message = 'Not found') => new HttpError(404, 'NOT_FOUND', message);
