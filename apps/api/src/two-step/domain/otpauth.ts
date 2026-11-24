export const OTP_ISSUER = "OrderPilot";

/**
 * The address a QR code carries and an authenticator app reads. The account is
 * percent-encoded because an email address holds characters a URI does not.
 * The algorithm, digits and period are what every app assumes anyway; saying
 * them keeps the ones that read them honestly.
 */
export function otpauthUri(account: string, secretBase32: string): string {
  const label = `${OTP_ISSUER}:${encodeURIComponent(account)}`;
  const query = [
    `secret=${secretBase32}`,
    `issuer=${OTP_ISSUER}`,
    "algorithm=SHA1",
    "digits=6",
    "period=30",
  ].join("&");
  return `otpauth://totp/${label}?${query}`;
}
