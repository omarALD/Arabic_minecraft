/* =========================================================
   world.ts — Chunk + World
   الإحداثيات: world (wx,wy,wz) → chunk (cx,cz) + local (lx,ly,lz)
     cx = floor(wx / CHUNK_SIZE),  lx = wx - cx * CHUNK_SIZE
   ========================================================= */
import { CHUNK_SIZE, WORLD_HEIGHT, type BlockId } from "./core";
import { generateChunk } from "./generator";

/* ---------- Chunk: تخزين مسطح، بايت لكل مكعب ---------- */
export class Chunk {
  readonly blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
  dirty = true;

  constructor(readonly cx: number, readonly cz: number) {}

  index(lx: number, y: number, lz: number): number {
    return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
  }

  getLocal(lx: number, y: number, lz: number): BlockId {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE ||
        y < 0 || y >= WORLD_HEIGHT) return 0;
    return this.blocks[this.index(lx, y, lz)] as BlockId;
  }

  setLocal(lx: number, y: number, lz: number, id: BlockId): void {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE ||
        y < 0 || y >= WORLD_HEIGHT) return;
    this.blocks[this.index(lx, y, lz)] = id;
    this.dirty = true;
  }
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function parseChunkKey(k: string): [number, number] {
  const [cx, cz] = k.split(",").map(Number);
  return [cx, cz];
}

/* ---------- World ---------- */
export class World {
  private chunks = new Map<string, Chunk>();
  /** تعديلات اللاعب — تبقى حتى لو أُفرغ الـ chunk من الذاكرة ثم عاد */
  private edits = new Map<string, Map<number, BlockId>>();

  constructor(readonly seed = 12345) {}

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  /** يُرجع الـ chunk ويولّده إن لم يوجد (ثم يطبّق تعديلات اللاعب عليه) */
  ensureChunk(cx: number, cz: number): Chunk {
    const k = chunkKey(cx, cz);
    let chunk = this.chunks.get(k);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      generateChunk(chunk, this.seed);
      const e = this.edits.get(k);
      if (e) for (const [i, id] of e) chunk.blocks[i] = id;
      this.chunks.set(k, chunk);
    }
    return chunk;
  }

  /** الـ chunks غير المحمّلة أو الارتفاع خارج النطاق ← 0. لا يرمي. */
  getBlock(wx: number, wy: number, wz: number): BlockId {
    if (wy < 0 || wy >= WORLD_HEIGHT) return 0;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return 0;
    return chunk.getLocal(wx - cx * CHUNK_SIZE, wy, wz - cz * CHUNK_SIZE);
  }

  /** يتجاهل الإحداثيات غير الصالحة. لا يولّد chunks. */
  setBlock(wx: number, wy: number, wz: number, id: BlockId): void {
    if (wy < 0 || wy >= WORLD_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const k = chunkKey(cx, cz);
    const chunk = this.chunks.get(k);
    if (!chunk) return;

    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    chunk.setLocal(lx, wy, lz, id);

    // سجّل التعديل ليبقى بعد الإفراغ
    let e = this.edits.get(k);
    if (!e) this.edits.set(k, (e = new Map()));
    e.set(chunk.index(lx, wy, lz), id);

    // لمسنا حدّ chunk ← الجار يحتاج إعادة mesh
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
  }

  private markDirty(cx: number, cz: number): void {
    const c = this.chunks.get(chunkKey(cx, cz));
    if (c) c.dirty = true;
  }

  /** يفرّغ الـ chunks البعيدة من الذاكرة (التعديلات محفوظة في edits) */
  pruneDistant(centerWX: number, centerWZ: number, maxDistance: number): number {
    const ccx = Math.floor(centerWX / CHUNK_SIZE);
    const ccz = Math.floor(centerWZ / CHUNK_SIZE);
    let pruned = 0;
    for (const key of [...this.chunks.keys()]) {
      const [cx, cz] = parseChunkKey(key);
      if (Math.abs(cx - ccx) > maxDistance || Math.abs(cz - ccz) > maxDistance) {
        this.chunks.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}
