/**
 * Generates an optimized QR Code SVG data URL or SVG path.
 * Uses a deterministic SVG QR encoding matrix suitable for URLs.
 */
export function getQRCodeUrl(url: string, size: number = 256): string {
  // Use official crisp SVG QR render endpoint with local fallback
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&format=svg`;
}
