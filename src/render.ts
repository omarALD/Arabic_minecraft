/* =========================================================
   render.ts — Three.js: المشهد + بناء هندسة الـ chunk + ChunkMesh
   النسيج (atlas) في ملف منفصل لأنه سيتغير مع كل مكعب جديد.
   ========================================================= */
import * as THREE from "three";
import { BLOCKS, CHUNK_SIZE, WORLD_HEIGHT } from "./core";
import type { World, Chunk } from "./world";
import { ATLAS_TILE_COUNT, UV_INSET } from "./atlas";

/* =========================================================
   1) المشهد والكاميرا
   ========================================================= */
export interface GameRenderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  dispose(): void;
}

export function createRenderer(container: HTMLElement): GameRenderer {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 25, 45);

  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 250);
  camera.rotation.order = "YXZ";

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 1));

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  window.addEventListener("resize", onResize);

  return {
    scene, camera, renderer,
    dispose() {
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}

/* =========================================================
   2) Mesher — تحويل chunk إلى بيانات هندسية
   ترتيب الوجوه يطابق BLOCKS.tiles: [+X, -X, +Y, -Y, +Z, -Z]
   ========================================================= */
interface FaceDef {
  dir: [number, number, number];
  corners: [number, number, number][];
  shade: number; // ظل بسيط يحاكي الإضاءة
}

const FACES: FaceDef[] = [
  { dir: [ 1, 0, 0], corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], shade: 0.80 },
  { dir: [-1, 0, 0], corners: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], shade: 0.80 },
  { dir: [ 0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], shade: 1.00 },
  { dir: [ 0,-1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], shade: 0.50 },
  { dir: [ 0, 0, 1], corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], shade: 0.65 },
  { dir: [ 0, 0,-1], corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], shade: 0.65 },
];

const UV_QUAD: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

function neighborSolid(world: World, chunk: Chunk, wx: number, wy: number, wz: number): boolean {
  const lx = wx - chunk.cx * CHUNK_SIZE;
  const lz = wz - chunk.cz * CHUNK_SIZE;
  if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
    return chunk.getLocal(lx, wy, lz) !== 0;
  }
  return world.getBlock(wx, wy, wz) !== 0;
}

export function meshChunk(world: World, chunk: Chunk): MeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let vi = 0;

  const ox = chunk.cx * CHUNK_SIZE;
  const oz = chunk.cz * CHUNK_SIZE;

  for (let ly = 0; ly < WORLD_HEIGHT; ly++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = chunk.getLocal(lx, ly, lz);
        if (id === 0) continue;
        const def = BLOCKS[id];

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          if (neighborSolid(world, chunk, ox + lx + face.dir[0], ly + face.dir[1], oz + lz + face.dir[2])) continue;

          const tile = def.tiles[f];
          const u0 = (tile + UV_INSET) / ATLAS_TILE_COUNT;
          const u1 = (tile + 1 - UV_INSET) / ATLAS_TILE_COUNT;

          for (let k = 0; k < 4; k++) {
            const c = face.corners[k];
            positions.push(lx + c[0], ly + c[1], lz + c[2]);
            normals.push(face.dir[0], face.dir[1], face.dir[2]);
            const uv = UV_QUAD[k];
            uvs.push(uv[0] === 0 ? u0 : u1, uv[1]);
            colors.push(face.shade, face.shade, face.shade);
          }
          indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
          vi += 4;
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
  };
}

/* =========================================================
   3) ChunkMesh — يربط Chunk بـ THREE.Mesh ويعيد البناء عند dirty
   ========================================================= */
export class ChunkMesh {
  readonly mesh: THREE.Mesh;

  constructor(private world: World, private chunk: Chunk, material: THREE.Material) {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
  }

  /** يعيد true إذا أُعيد بناء الـ mesh */
  update(): boolean {
    if (!this.chunk.dirty) return false;
    this.chunk.dirty = false;

    const data = meshChunk(this.world, this.chunk);
    const geom = this.mesh.geometry;
    geom.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    geom.setAttribute("normal",   new THREE.BufferAttribute(data.normals, 3));
    geom.setAttribute("uv",       new THREE.BufferAttribute(data.uvs, 2));
    geom.setAttribute("color",    new THREE.BufferAttribute(data.colors, 3));
    geom.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geom.computeBoundingSphere();
    return true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}
