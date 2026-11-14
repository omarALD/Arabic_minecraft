/* =========================================================
   physics.ts — صندوق الإحاطة + التصادم + تتبّع الأشعة
   يعرف World فقط (كنوع). لا يعرف Three.js.
   ========================================================= */
import type { World } from "./world";
import { PLAYER_WIDTH, PLAYER_HEIGHT, REACH } from "./core";

/* ---------- AABB ---------- */
export interface AABB {
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
}

/** صندوق إحاطة اللاعب — أصله عند مركز القدمين */
export function playerAABB(x: number, y: number, z: number): AABB {
  const hw = PLAYER_WIDTH / 2;
  return {
    minX: x - hw, minY: y, minZ: z - hw,
    maxX: x + hw, maxY: y + PLAYER_HEIGHT, maxZ: z + hw,
  };
}

export function aabbOverlapsBlock(box: AABB, bx: number, by: number, bz: number): boolean {
  return box.maxX > bx && box.minX < bx + 1 &&
         box.maxY > by && box.minY < by + 1 &&
         box.maxZ > bz && box.minZ < bz + 1;
}

/* ---------- التصادم ---------- */
export function collidesAt(world: World, x: number, y: number, z: number): boolean {
  const box = playerAABB(x, y, z);
  const x0 = Math.floor(box.minX), x1 = Math.floor(box.maxX);
  const y0 = Math.floor(box.minY), y1 = Math.floor(box.maxY);
  const z0 = Math.floor(box.minZ), z1 = Math.floor(box.maxZ);

  for (let by = y0; by <= y1; by++) {
    for (let bz = z0; bz <= z1; bz++) {
      for (let bx = x0; bx <= x1; bx++) {
        if (world.getBlock(bx, by, bz) !== 0 && aabbOverlapsBlock(box, bx, by, bz)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * يحرّك اللاعب على محور واحد ويوقفه عند التصادم.
 * التقسيم لخطوات صغيرة يمنع اختراق الجدران.
 * @returns المسافة الفعلية المقطوعة
 */
export function moveAxis(
  world: World,
  pos: { x: number; y: number; z: number },
  axis: "x" | "y" | "z",
  delta: number
): number {
  if (delta === 0) return 0;
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / 0.2));
  const step = delta / steps;
  let moved = 0;

  for (let i = 0; i < steps; i++) {
    pos[axis] += step;
    if (collidesAt(world, pos.x, pos.y, pos.z)) {
      pos[axis] -= step;
      break;
    }
    moved += step;
  }
  return moved;
}

/* ---------- Raycast (Amanatides-Woo DDA) ---------- */
export interface RaycastHit {
  x: number; y: number; z: number;
  nx: number; ny: number; nz: number; // الوجه الذي أُصيب
  distance: number;
}

export function raycastVoxel(
  world: World,
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  maxDist: number = REACH
): RaycastHit | null {
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (len === 0) return null;
  const dx = dir.x / len, dy = dir.y / len, dz = dir.z / len;

  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = dx >= 0 ? 1 : -1;
  const stepY = dy >= 0 ? 1 : -1;
  const stepZ = dz >= 0 ? 1 : -1;

  const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
  const tDeltaZ = dz === 0 ? Infinity : Math.abs(1 / dz);

  const fx = origin.x - Math.floor(origin.x);
  const fy = origin.y - Math.floor(origin.y);
  const fz = origin.z - Math.floor(origin.z);

  let tMaxX = dx === 0 ? Infinity : (stepX > 0 ? 1 - fx : fx) * tDeltaX;
  let tMaxY = dy === 0 ? Infinity : (stepY > 0 ? 1 - fy : fy) * tDeltaY;
  let tMaxZ = dz === 0 ? Infinity : (stepZ > 0 ? 1 - fz : fz) * tDeltaZ;

  let nx = 0, ny = 0, nz = 0, t = 0;

  for (let i = 0; i < 512; i++) {
    if (world.getBlock(x, y, z) !== 0) {
      return { x, y, z, nx, ny, nz, distance: t };
    }

    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX;
      nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY;
      nx = 0; ny = -stepY; nz = 0;
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ;
      nx = 0; ny = 0; nz = -stepZ;
    }

    if (t > maxDist) break;
  }
  return null;
}
