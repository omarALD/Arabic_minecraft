/* =========================================================
   fx.ts — مؤثرات: إطار المكعب المستهدف + التشققات + الجزيئات
   ========================================================= */
import * as THREE from "three";

const STAGES = 10;

/** 10 مراحل تشقق، كل مرحلة تضيف بكسلات داكنة */
function makeCrackTextures(): THREE.CanvasTexture[] {
  const order = Array.from({ length: 256 }, (_, i) => i);
  let s = 12345;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 255; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    [order[i], order[j]] = [order[j], order[i]];
  }

  const out: THREE.CanvasTexture[] = [];
  for (let st = 0; st < STAGES; st++) {
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    const n = Math.floor(((st + 1) / STAGES) * 256 * 0.55);
    for (let i = 0; i < n; i++) {
      const p = order[i];
      ctx.fillRect(p % 16, (p / 16) | 0, 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    out.push(t);
  }
  return out;
}

/* ---------- إطار + تشققات ---------- */
export class BlockHighlight {
  private outline: THREE.LineSegments;
  private crack: THREE.Mesh;
  private textures = makeCrackTextures();

  constructor(scene: THREE.Scene) {
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x000000 })
    );
    this.outline.visible = false;

    this.crack = new THREE.Mesh(
      new THREE.BoxGeometry(1.006, 1.006, 1.006),
      new THREE.MeshBasicMaterial({
        map: this.textures[0],
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    this.crack.visible = false;

    scene.add(this.outline, this.crack);
  }

  show(x: number, y: number, z: number): void {
    this.outline.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.crack.position.copy(this.outline.position);
    this.outline.visible = true;
  }

  hide(): void {
    this.outline.visible = false;
    this.crack.visible = false;
  }

  /** p بين 0 و 1 */
  setProgress(p: number): void {
    if (p <= 0) { this.crack.visible = false; return; }
    const stage = Math.min(STAGES - 1, Math.floor(p * STAGES));
    (this.crack.material as THREE.MeshBasicMaterial).map = this.textures[stage];
    (this.crack.material as THREE.MeshBasicMaterial).needsUpdate = true;
    this.crack.visible = true;
  }
}

/* ---------- جزيئات الكسر ---------- */
interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

export class Particles {
  private list: Particle[] = [];
  private geo = new THREE.BoxGeometry(1, 1, 1);

  constructor(private scene: THREE.Scene) {}

  burst(x: number, y: number, z: number, color: string, count = 14): void {
    for (let i = 0; i < count; i++) {
      const size = 0.07 + Math.random() * 0.09;
      const mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color }));
      mesh.scale.setScalar(size);
      mesh.position.set(x + Math.random(), y + Math.random(), z + Math.random());
      this.scene.add(mesh);
      this.list.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4),
        life: 0.5 + Math.random() * 0.4,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.list.splice(i, 1);
        continue;
      }
      p.vel.y -= 20 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
    }
  }
}
