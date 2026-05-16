import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AnalysisFailedError } from "@/lib/utils/errors";

const VERSION = "v1";
const IV_BYTES = 12;

function getSecretKey(): Buffer {
  const secret = process.env.ANALYSIS_JOB_SECRET;

  if (!secret || secret.length < 32) {
    throw new AnalysisFailedError("ANALYSIS_JOB_SECRET must be set to at least 32 characters.");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptAnalysisSecret(value: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getSecretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptAnalysisSecret(payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split(".");

  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new AnalysisFailedError("Analysis job credential payload is invalid.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getSecretKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
