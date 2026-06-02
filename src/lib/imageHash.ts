/**
 * Tiny client-side hashers for duplicate-bill detection.
 * - computeImagePhash: 64-bit average-hash (aHash) of the bill photo.
 *   Same photo → identical hash. Cheap, no deps.
 * - computeContentHash: SHA-256 of (store|date|total|sorted item names).
 *   Same bill re-photographed from a different angle still matches.
 */

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export async function computeImagePhash(file: File): Promise<string> {
  try {
    const img = await loadImage(file);
    const canvas = document.createElement("canvas");
    canvas.width = 8; canvas.height = 8;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(img, 0, 0, 8, 8);
    const { data } = ctx.getImageData(0, 0, 8, 8);
    const grays: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      grays.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    const avg = grays.reduce((s, x) => s + x, 0) / grays.length;
    let bits = "";
    for (const g of grays) bits += g >= avg ? "1" : "0";
    let hex = "";
    for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  } catch {
    return "";
  }
}

export async function computeContentHash(parts: {
  store: string;
  date: string;
  total: number;
  items: string[];
}): Promise<string> {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const datePart = (parts.date || "").slice(0, 10);
  const itemPart = parts.items.map(norm).sort().join(",");
  const s = `${norm(parts.store)}|${datePart}|${parts.total.toFixed(2)}|${itemPart}`;
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}