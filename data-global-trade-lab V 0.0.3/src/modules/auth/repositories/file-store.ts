import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ensureFile = async (filePath: string, rootKey: string) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    try {
        await fs.access(filePath);
    } catch {
        await fs.writeFile(filePath, JSON.stringify({ [rootKey]: [] }, null, 2));
    }
};

export const readCollection = async <T>(filePath: string, rootKey: string): Promise<T[]> => {
    await ensureFile(filePath, rootKey);
    const raw = await fs.readFile(filePath, "utf8");
    let parsed: Record<string, unknown>;

    try {
        parsed = JSON.parse(raw || "{}");
    } catch {
        const backupPath = `${filePath}.corrupted-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.bak`;
        await fs.writeFile(backupPath, raw, "utf8");
        await fs.writeFile(filePath, JSON.stringify({ [rootKey]: [] }, null, 2));
        return [];
    }

    return Array.isArray(parsed[rootKey]) ? parsed[rootKey] : [];
};

export const writeCollection = async <T>(filePath: string, rootKey: string, records: T[]) => {
    await ensureFile(filePath, rootKey);
    const nextContent = JSON.stringify({ [rootKey]: records }, null, 2);
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, nextContent, "utf8");
    await fs.rename(tempPath, filePath);
};
