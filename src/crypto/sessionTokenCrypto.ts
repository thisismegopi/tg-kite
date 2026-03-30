import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "v1:";
const IV_LEN = 12;
const TAG_LEN = 16;
const ALGO = "aes-256-gcm";

export function encryptSessionToken(plain: string | null | undefined, key: Buffer): string | null {
    if (plain == null || plain === "") {
        return null;
    }
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, tag, enc]);
    return `${PREFIX}${payload.toString("base64")}`;
}

export function decryptSessionToken(stored: string | null | undefined, key: Buffer): string | null {
    if (stored == null || stored === "") {
        return null;
    }
    if (!stored.startsWith(PREFIX)) {
        return stored;
    }
    const b64 = stored.slice(PREFIX.length);
    const buf = Buffer.from(b64, "base64");
    if (buf.length < IV_LEN + TAG_LEN + 1) {
        return stored;
    }
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
