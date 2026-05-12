import crypto from "node:crypto";

export const hashPassword = async (password: string) => {
    const salt = crypto.randomBytes(16).toString("hex");
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
        crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, result) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(result as Buffer);
        });
    });

    return `scrypt$16384$8$1$${salt}$${derivedKey.toString("hex")}`;
};

export const verifyPassword = async (password: string, storedValue: string) => {
    const [algorithm, nValue, rValue, pValue, salt, expectedHash] = String(storedValue || "").split("$");
    if (algorithm !== "scrypt" || !salt || !expectedHash) {
        return false;
    }

    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
        crypto.scrypt(
            password,
            salt,
            expectedHash.length / 2,
            {
                N: Number.parseInt(nValue, 10),
                r: Number.parseInt(rValue, 10),
                p: Number.parseInt(pValue, 10),
            },
            (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(result as Buffer);
            }
        );
    });

    return crypto.timingSafeEqual(Buffer.from(derivedKey.toString("hex")), Buffer.from(expectedHash));
};
