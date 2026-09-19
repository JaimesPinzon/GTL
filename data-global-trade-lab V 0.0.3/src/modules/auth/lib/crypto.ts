import crypto from "node:crypto";

export const nowIso = () => new Date().toISOString();
export const randomId = () => crypto.randomUUID();
export const randomToken = (size = 32) => crypto.randomBytes(size).toString("base64url");
export const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

const deriveSessionEncryptionKey = (secret: string) =>
    crypto.createHash("sha256").update(`gtl-refresh-replay:v1:${secret}`).digest();

export const deriveCsrfToken = (refreshToken: string, secret: string) =>
    crypto.createHmac("sha256", secret).update(`gtl-csrf:v1:${refreshToken}`).digest("base64url");

export const encryptSessionSecret = (value: string, secret: string) => {
    const initializationVector = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", deriveSessionEncryptionKey(secret), initializationVector);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const authenticationTag = cipher.getAuthTag();

    return [
        "v1",
        initializationVector.toString("base64url"),
        authenticationTag.toString("base64url"),
        encrypted.toString("base64url"),
    ].join(".");
};

export const decryptSessionSecret = (value: string, secret: string) => {
    const [version, initializationVector, authenticationTag, encrypted] = String(value || "").split(".");
    if (version !== "v1" || !initializationVector || !authenticationTag || !encrypted) {
        throw new Error("Invalid encrypted session secret.");
    }

    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        deriveSessionEncryptionKey(secret),
        Buffer.from(initializationVector, "base64url")
    );
    decipher.setAuthTag(Buffer.from(authenticationTag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
};

export const encodeBase64Url = (input: string) =>
    Buffer.from(input)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

export const decodeBase64Url = (input: string) => {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const paddingLength = (4 - (normalized.length % 4 || 4)) % 4;
    return Buffer.from(`${normalized}${"=".repeat(paddingLength)}`, "base64");
};
