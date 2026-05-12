import crypto from "node:crypto";

import { authConfig } from "@/modules/auth/config";
import { AuthHttpError } from "@/modules/auth/errors";
import { decodeBase64Url, encodeBase64Url } from "@/modules/auth/lib/crypto";
import { VerifiedAccessTokenPayload } from "@/modules/auth/types";

export const signAccessToken = (payload: Record<string, unknown>) => {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = {
        ...payload,
        iat: now,
        exp: now + authConfig.accessTokenTtlSeconds,
    };

    const headerSegment = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payloadSegment = encodeBase64Url(JSON.stringify(fullPayload));
    const signingInput = `${headerSegment}.${payloadSegment}`;
    const signature = crypto.createHmac("sha256", authConfig.accessTokenSecret).update(signingInput).digest("base64url");
    return `${signingInput}.${signature}`;
};

export const verifyAccessToken = (token: string): VerifiedAccessTokenPayload => {
    const [headerSegment, payloadSegment, signatureSegment] = String(token || "").split(".");
    if (!headerSegment || !payloadSegment || !signatureSegment) {
        throw new AuthHttpError(401, "Malformed JWT.");
    }

    const signingInput = `${headerSegment}.${payloadSegment}`;
    const expectedSignature = crypto.createHmac("sha256", authConfig.accessTokenSecret).update(signingInput).digest();
    const providedSignature = Buffer.from(signatureSegment, "base64url");

    if (
        expectedSignature.length !== providedSignature.length ||
        !crypto.timingSafeEqual(expectedSignature, providedSignature)
    ) {
        throw new AuthHttpError(401, "Invalid JWT signature.");
    }

    const payload = JSON.parse(decodeBase64Url(payloadSegment).toString("utf8"));
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) {
        throw new AuthHttpError(401, "JWT expired.");
    }

    return payload as VerifiedAccessTokenPayload;
};
