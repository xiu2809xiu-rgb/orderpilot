import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const LABEL = "orderpilot:two-step:secret:v1";
const VERSION = "v1";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

/**
 * The sealing key: HKDF-SHA256 from the one secret the API already has, under a
 * fixed label, so no new variable is needed. Rotating JWT_SECRET therefore
 * makes every sealed secret unreadable (ADR 0067 says what people do then).
 */
export function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, Buffer.alloc(0), LABEL, 32));
}

/**
 * Seals a small secret with AES-256-GCM. The text is `v1.<nonce>.<ciphertext>.<tag>`
 * in base64url. The person's id is the associated data, so a ciphertext copied
 * into another person's row does not open.
 */
export class SecretBox {
  constructor(private readonly key: Buffer) {}

  seal(plain: Buffer, userId: string): string {
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    cipher.setAAD(Buffer.from(userId));
    const body = Buffer.concat([cipher.update(plain), cipher.final()]);
    return [
      VERSION,
      nonce.toString("base64url"),
      body.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
    ].join(".");
  }

  /** The secret, or null when the text, the key or the person is not the one it was sealed for. */
  open(sealed: string, userId: string): Buffer | null {
    const [version, nonceText, bodyText, tagText, ...rest] = sealed.split(".");
    if (
      version !== VERSION ||
      nonceText === undefined ||
      bodyText === undefined ||
      tagText === undefined ||
      rest.length > 0
    ) {
      return null;
    }
    const nonce = Buffer.from(nonceText, "base64url");
    const tag = Buffer.from(tagText, "base64url");
    if (nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES) return null;
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key, nonce);
      decipher.setAAD(Buffer.from(userId));
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(Buffer.from(bodyText, "base64url")),
        decipher.final(),
      ]);
    } catch {
      return null;
    }
  }
}
