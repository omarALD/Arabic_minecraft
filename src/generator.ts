import { CHUNK_SIZE, WORLD_HEIGHT, type BlockId } from "./core";
import type { Chunk } from "./world";

/* =========================================================
   ضوضاء حتمية (Deterministic Noise)
   نفس الإحداثيات + نفس البذرة = نفس النتيجة دائماً.
   ========================================================= */

function hash2(x: number, z: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^
          Math.imul(z | 0, 668265263) ^
          Math.imul(seed | 0, 1013904223);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}

function valueNoise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, seed);
  const b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed);
  const d = hash2(xi + 1, zi + 1, seed);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) +
         c * (1 - u) * v + d * u * v;
}

function fbm(x: number, z: number, seed: number): number {
  let total = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < 4; i++) {
    total += valueNoise(x * freq, z * freq, seed + i * 17) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return total / max;
}

/* =========================================================
   ارتفاع التضاريس (دالة نقية — قابلة للاستدعاء من أي مكان)
   ========================================================= */
export function terrainHeight(wx: number, wz: number, seed: number): number {
  const continental = fbm(wx * 0.008, wz * 0.008, seed);
  const hills       = fbm(wx * 0.03,  wz * 0.03,  seed + 500);
  const detail      = fbm(wx * 0.1,   wz * 0.1,   seed + 1000);

  const h = 8 + continental * 18 + hills * 6 + detail * 2;
  return Math.max(1, Math.min(Math.floor(h), WORLD_HEIGHT - 10));
}

/* =========================================================
   الأشجار — توزيع حتمي على شبكة 6×6
   ========================================================= */
function shouldPlantTree(wx: number, wz: number, seed: number): boolean {
  if (wx % 6 !== 0 || wz % 6 !== 0) return false;
  return hash2(wx / 6, wz / 6, seed + 7777) < 0.5;
}

/* =========================================================
   التوليد الرئيسي
   ========================================================= */
export function generateChunk(chunk: Chunk, seed: number): void {
  const ox = chunk.cx * CHUNK_SIZE;
  const oz = chunk.cz * CHUNK_SIZE;

  // 1) التضاريس
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = ox + lx, wz = oz + lz;
      const h = terrainHeight(wx, wz, seed);

      for (let y = 0; y <= h; y++) {
        let id: BlockId;
        if (y === h)              id = h <= 5 ? 6 : (h > 28 ? 3 : 1); // سطح
        else if (y > h - 4)       id = h <= 5 ? 6 : (h > 28 ? 3 : 2); // طبقة
        else                      id = 3;                              // حجر
        chunk.setLocal(lx, y, lz, id);
      }
    }
  }

  // 2) الأشجار — نفحص مواقع في نطاق ±3 حول حدود الـ chunk
  //    حتى لا تُقطع الأشجار عند الحدود بين الـ chunks
  for (let wx = ox - 3; wx < ox + CHUNK_SIZE + 3; wx++) {
    for (let wz = oz - 3; wz < oz + CHUNK_SIZE + 3; wz++) {
      if (!shouldPlantTree(wx, wz, seed)) continue;
      placeTreePart(chunk, wx, wz, seed);
    }
  }

  chunk.dirty = true;
}

/** يزرع فقط الأجزاء من الشجرة التي تقع داخل هذا الـ chunk */
function placeTreePart(chunk: Chunk, wx: number, wz: number, seed: number): void {
  const h = terrainHeight(wx, wz, seed);
  const trunkHeight = 4 + Math.floor(hash2(wx, wz, seed + 8888) * 3);
  const cy = h + trunkHeight;

  // الجذع
  for (let t = 1; t <= trunkHeight; t++) {
    trySetWorld(chunk, wx, h + t, wz, 4);
  }

  // التاج
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = -1; dy <= 2; dy++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 3) continue;
        trySetWorld(chunk, wx + dx, cy + dy, wz + dz, 5);
      }
    }
  }
}

function trySetWorld(chunk: Chunk, wx: number, wy: number, wz: number, id: BlockId): void {
  const ox = chunk.cx * CHUNK_SIZE;
  const oz = chunk.cz * CHUNK_SIZE;
  const lx = wx - ox;
  const lz = wz - oz;
  if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
  if (wy < 0 || wy >= WORLD_HEIGHT) return;
  if (chunk.getLocal(lx, wy, lz) !== 0) return; // لا نستبدل مكعباً موجوداً
  chunk.setLocal(lx, wy, lz, id);
}