import * as THREE from "three";

const TILE_SIZE = 16;
export const ATLAS_TILE_COUNT = 9;
export const UV_INSET = 0.005; // هامش صغير لتجنب تسريب النسيج بين البلاطات
let atlasCanvas: HTMLCanvasElement | null = null;

/** أيقونة بلاطة كـ dataURL للشريط */
export function tileIcon(tile: number): string {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlasCanvas!, tile * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, 0, 0, 64, 64);
  return c.toDataURL();
}
/* =========================================================
   أدوات رسم
   ========================================================= */

function createTileCanvas(draw: (data: Uint8ClampedArray) => void): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  draw(img.data);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function fillNoise(data: Uint8ClampedArray, r: number, g: number, b: number, variance: number): void {
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * variance;
    data[i]     = Math.max(0, Math.min(255, r + n));
    data[i + 1] = Math.max(0, Math.min(255, g + n));
    data[i + 2] = Math.max(0, Math.min(255, b + n));
    data[i + 3] = 255;
  }
}

function setPx(data: Uint8ClampedArray, x: number, y: number, r: number, g: number, b: number): void {
  const i = (y * TILE_SIZE + x) * 4;
  data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
}

/* =========================================================
   توليد البلاطات التسع
   الترتيب يجب أن يطابق BLOCKS.tiles في core/blocks.ts
   ========================================================= */

/* 0) سطح العشب */
function tileGrassTop(): HTMLCanvasElement {
  return createTileCanvas(d => {
    fillNoise(d, 96, 156, 60, 34);
    for (let i = 0; i < 16; i++)
      setPx(d, Math.random() * TILE_SIZE | 0, Math.random() * TILE_SIZE | 0, 70, 122, 42);
  });
}

/* 1) جانب العشب — تراب مع شريط أخضر علوي */
function tileGrassSide(): HTMLCanvasElement {
  return createTileCanvas(d => {
    fillNoise(d, 138, 100, 70, 26);
    for (let x = 0; x < TILE_SIZE; x++) {
      const h = 3 + (Math.random() * 3 | 0);
      for (let y = 0; y < h; y++) {
        const n = (Math.random() - 0.5) * 30;
        setPx(d, x, y, Math.max(0, 96 + n), Math.max(0, 156 + n), Math.max(0, 60 + n));
      }
    }
  });
}

/* 2) تراب */
function tileDirt(): HTMLCanvasElement {
  return createTileCanvas(d => fillNoise(d, 138, 100, 70, 28));
}

/* 3) حجر */
function tileStone(): HTMLCanvasElement {
  return createTileCanvas(d => {
    fillNoise(d, 128, 128, 128, 34);
    for (let i = 0; i < 12; i++)
      setPx(d, Math.random() * TILE_SIZE | 0, Math.random() * TILE_SIZE | 0, 100, 100, 100);
  });
}

/* 4) جانب الخشب — خطوط رأسية */
function tileWoodSide(): HTMLCanvasElement {
  return createTileCanvas(d => {
    fillNoise(d, 112, 82, 50, 18);
    for (let x = 0; x < TILE_SIZE; x++) {
      if (x % 4 === 0) {
        for (let y = 0; y < TILE_SIZE; y++) setPx(d, x, y, 86, 62, 38);
      }
    }
  });
}

/* 5) مقطع الخشب — حلقات متحدة المركز */
function tileWoodRings(): HTMLCanvasElement {
  return createTileCanvas(d => {
    fillNoise(d, 150, 112, 68, 14);
    const c = 7.5;
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const r = Math.hypot(x - c, y - c);
        if (Math.abs(r - 3) < 0.6 || Math.abs(r - 6) < 0.7) {
          setPx(d, x, y, 110, 80, 46);
        }
      }
    }
  });
}

/* 6) أوراق */
function tileLeaves(): HTMLCanvasElement {
  return createTileCanvas(d => {
    fillNoise(d, 62, 120, 46, 62);
    for (let i = 0; i < 34; i++)
      setPx(d, Math.random() * TILE_SIZE | 0, Math.random() * TILE_SIZE | 0, 40, 84, 30);
  });
}

/* 7) رمل */
function tileSand(): HTMLCanvasElement {
  return createTileCanvas(d => fillNoise(d, 222, 208, 160, 20));
}

/* 8) ألواح خشبية — خطوط أفقية */
function tilePlanks(): HTMLCanvasElement {
  return createTileCanvas(d => {
    fillNoise(d, 172, 132, 82, 16);
    for (let y = 0; y < TILE_SIZE; y++) {
      if (y % 4 === 0) {
        for (let x = 0; x < TILE_SIZE; x++) setPx(d, x, y, 140, 104, 62);
      }
    }
  });
}
export const ATLAS_TILE_COUNT = 10;

function tileBricks(): HTMLCanvasElement {
  return createTileCanvas(d => {
    fillNoise(d, 160, 82, 60, 20);
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const row = y >> 2;
        const off = row % 2 ? 4 : 0;
        if (y % 4 === 0 || (x + off) % 8 === 0) setPx(d, x, y, 200, 190, 180);
      }
    }
  });
}
// وأضفها في مصفوفة tiles بعد tilePlanks()

/* =========================================================
   بناء الأطلس النهائي
   ========================================================= */
export function buildAtlas(): THREE.CanvasTexture {
  const tiles = [
    tileGrassTop(),   // 0
    tileGrassSide(),  // 1
    tileDirt(),       // 2
    tileStone(),      // 3
    tileWoodSide(),   // 4
    tileWoodRings(),  // 5
    tileLeaves(),     // 6
    tileSand(),       // 7
    tilePlanks(),     // 8
    
  ];

  const atlas = document.createElement("canvas");
  atlas.width = TILE_SIZE * ATLAS_TILE_COUNT;
  atlas.height = TILE_SIZE;
  const ctx = atlas.getContext("2d")!;
  atlasCanvas = atlas;
  tiles.forEach((t, i) => ctx.drawImage(t, i * TILE_SIZE, 0));

  const tex = new THREE.CanvasTexture(atlas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}