/* =========================================================
   mining.ts — المخزون + التكسير التدريجي
   ========================================================= */
import { BLOCKS, CREATIVE, REACH, type BlockId } from "./core";
import type { World } from "./world";
import type { Player } from "./player";
import { raycastVoxel } from "./physics";
import type { BlockHighlight, Particles } from "./fx";

export class Inventory {
  private counts = new Map<number, number>();
  onChange: () => void = () => {};

  get(id: BlockId): number {
    return this.counts.get(id) ?? 0;
  }

  has(id: BlockId): boolean {
    return CREATIVE || this.get(id) > 0;
  }

  add(id: BlockId, n = 1): void {
    this.counts.set(id, this.get(id) + n);
    this.onChange();
  }

  consume(id: BlockId): void {
    if (CREATIVE) return;
    this.counts.set(id, Math.max(0, this.get(id) - 1));
    this.onChange();
  }
}

export class Mining {
  private tx = NaN;
  private ty = NaN;
  private tz = NaN;
  private progress = 0;

  constructor(
    private world: World,
    private player: Player,
    private highlight: BlockHighlight,
    private particles: Particles,
    private inv: Inventory
  ) {}

  private reset(): void {
    this.tx = this.ty = this.tz = NaN;
    this.progress = 0;
    this.highlight.setProgress(0);
  }

  /** استدعها كل إطار (فقط والماوس مقفل) */
  update(dt: number, breaking: boolean): void {
    const hit = raycastVoxel(this.world, this.player.eyePosition(), this.player.lookDirection(), REACH);
    if (!hit) {
      this.highlight.hide();
      this.reset();
      return;
    }

    this.highlight.show(hit.x, hit.y, hit.z);

    // الطبقة السفلية (y=0) غير قابلة للكسر
    if (!breaking || hit.y <= 0) {
      this.reset();
      return;
    }

    // انتقلنا لمكعب آخر ← نبدأ من الصفر
    if (hit.x !== this.tx || hit.y !== this.ty || hit.z !== this.tz) {
      this.tx = hit.x; this.ty = hit.y; this.tz = hit.z;
      this.progress = 0;
    }

    const id = this.world.getBlock(hit.x, hit.y, hit.z);
    if (id === 0) { this.reset(); return; }
    const def = BLOCKS[id];

    this.progress += dt / def.hardness;
    this.highlight.setProgress(this.progress);

    if (this.progress >= 1) {
      this.world.setBlock(hit.x, hit.y, hit.z, 0);
      this.particles.burst(hit.x, hit.y, hit.z, def.color);
      this.inv.add(def.drop);
      this.reset();
    }
  }
}
