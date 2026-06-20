import * as crypto from "crypto";
import {HttpsError} from "firebase-functions/v2/https";

const ENCRYPTION_ALGORITHM = "aes-256-cbc";
const ENCRYPTION_KEY_HEX_LENGTH = 64;
const ENCRYPTED_TOKEN_IV_HEX_LENGTH = 32;

const isHexString = (value: string): boolean => {
  return /^[0-9a-fA-F]+$/.test(value);
};

export const isValidEncryptionKey = (value: string): boolean => {
  return (
    value.length === ENCRYPTION_KEY_HEX_LENGTH &&
    isHexString(value)
  );
};

export const encryptToken = (plaintext: string, keyHex: string): string => {
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
};

export const isEncryptedToken = (value: string): boolean => {
  const parts = value.split(":");

  if (parts.length !== 2) {
    return false;
  }

  const [ivHex, encryptedHex] = parts;

  if (ivHex === undefined || encryptedHex === undefined) {
    return false;
  }

  return (
    ivHex.length === ENCRYPTED_TOKEN_IV_HEX_LENGTH &&
    encryptedHex.length > 0 &&
    isHexString(ivHex) &&
    isHexString(encryptedHex)
  );
};

export const decryptToken = (ciphertext: string, keyHex: string): string => {
  const [ivHex, encryptedHex] = ciphertext.split(":");

  if (
    ivHex === undefined ||
    encryptedHex === undefined ||
    ivHex.length === 0 ||
    encryptedHex.length === 0
  ) {
    throw new HttpsError("internal", "Encrypted Strava token is invalid.");
  }

  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const encryptedBuffer = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const decrypted = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

export const decryptTokenOrLegacy = (
  token: string,
  keyHex: string
): string => {
  if (!isEncryptedToken(token)) {
    return token;
  }

  return decryptToken(token, keyHex);
};
