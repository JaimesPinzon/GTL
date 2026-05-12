import crypto from "node:crypto";

export const nowIso = () => new Date().toISOString();
export const randomId = () => crypto.randomUUID();
export const randomToken = (size = 32) => crypto.randomBytes(size).toString("base64url");
export const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

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
