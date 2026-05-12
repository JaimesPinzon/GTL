export class AuthHttpError extends Error {
    statusCode: number;
    details?: unknown;

    constructor(statusCode: number, message: string, details?: unknown) {
        super(message);
        this.name = "AuthHttpError";
        this.statusCode = statusCode;
        this.details = details;
    }
}

export const assertAuth = (condition: unknown, statusCode: number, message: string, details?: unknown) => {
    if (!condition) {
        throw new AuthHttpError(statusCode, message, details);
    }
};
