/* =========================================================
   main.ts — الربط بين الوحدات (الإعداد + حلقة اللعبة)
   ========================================================= */
import * as THREE from "three";
import { World, chunkKey, parseChunkKey } from "./world";
import { WORLD_HEIGHT, CHUNK_SIZE, RENDER_DISTANCE, BLOCKS, HOTBAR, CREATIVE, type BlockId } from "./core";
import { createRenderer, ChunkMesh } from "./render";
import { buildAtlas, tileIcon } from "./atlas";
import { Input } from "./input";
import { Player } from "./player";
import { BlockHighlight, Particles } from "./fx";
import { Inventory, Mining } from "./mining";

/* ---------- الإعداد ---------- */
const app = document.getElementById("app")!;
const overlay = document.getElementById("overlay")!;
const hotbarEl = document.getElementById("hotbar")!;

const gr = createRenderer(app);
const chunkMaterial = new THREE.MeshBasicMaterial({ map: buildAtlas(), vertexColors: true });

const world = new World(12345);
const input = new Input(gr.renderer.domElement, overlay);
const player = new Player(world, input);

const inventory = new Inventory();
const highlight = new BlockHighlight(gr.scene);
const particles = new Particles(gr.scene);
const mining = new Mining(world, player, highlight, particles, inventory);

const def = (id: BlockId) => BLOCKS[id as Exclude<BlockId, 0>];

/* ---------- إدارة الـ chunk meshes ---------- */
const UNLOAD_DIST = RENDER_DISTANCE + 1;
const chunkMeshes = new Map<string, ChunkMesh>();

function ensureMesh(cx: number, cz: number): void {
  const k = chunkKey(cx, cz);
  if (chunkMeshes.has(k)) return;
  const cm = new ChunkMesh(world, world.ensureChunk(cx, cz), chunkMaterial);
  cm.update();
  gr.scene.add(cm.mesh);
  chunkMeshes.set(k, cm);
}

function loadAround(wx: number, wz: number): void {
  const ccx = Math.floor(wx / CHUNK_SIZE);
  const ccz = Math.floor(wz / CHUNK_SIZE);
  for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++)
    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++)
      ensureMesh(ccx + dx, ccz + dz);
}

function unloadFar(wx: number, wz: number): void {
  const ccx = Math.floor(wx / CHUNK_SIZE);
  const ccz = Math.floor(wz / CHUNK_SIZE);
  for (const [k, cm] of chunkMeshes) {
    const [cx, cz] = parseChunkKey(k);
    if (Math.abs(cx - ccx) > UNLOAD_DIST || Math.abs(cz - ccz) > UNLOAD_DIST) {
      gr.scene.remove(cm.mesh);
      cm.dispose();
      chunkMeshes.delete(k);
    }
  }
  world.pruneDistant(wx, wz, UNLOAD_DIST);
}

let lastCX = Number.NaN, lastCZ = Number.NaN;

function ensureAroundLoaded(wx: number, wz: number): void {
  const ccx = Math.floor(wx / CHUNK_SIZE);
  const ccz = Math.floor(wz / CHUNK_SIZE);
  if (ccx === lastCX && ccz === lastCZ) return;
  lastCX = ccx; lastCZ = ccz;
  loadAround(wx, wz);
  unloadFar(wx, wz);
}

/* ---------- نقطة الظهور ---------- */
world.ensureChunk(0, 0);
let spawnY = 20;
for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
  if (world.getBlock(0, y, 0) !== 0) { spawnY = y + 1; break; }
}
player.pos.set(0.5, spawnY + 0.1, 0.5);

loadAround(player.pos.x, player.pos.z);
lastCX = 0; lastCZ = 0;

/* =========================================================
   الواجهة: شريط المكعبات + اسم المكعب + F3
   ========================================================= */
let selected = 0;

const nameEl = document.createElement("div");
nameEl.id = "blockname";
document.body.appendChild(nameEl);

const debugEl = document.createElement("div");
debugEl.id = "debug";
document.body.appendChild(debugEl);

let nameTimer = 0;
function flashName(text: string): void {
  nameEl.textContent = text;
  nameEl.classList.add("show");
  clearTimeout(nameTimer);
  nameTimer = window.setTimeout(() => nameEl.classList.remove("show"), 1400);
}

function buildHotbarUI(): void {
  hotbarEl.innerHTML = "";
  HOTBAR.forEach((id, i) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.title = def(id).name;

    const icon = document.createElement("div");
    icon.className = "icon";
    icon.style.backgroundImage = `url(${tileIcon(def(id).tiles[0])})`;

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(i + 1);

    const count = document.createElement("span");
    count.className = "count";

    slot.append(icon, num, count);
    slot.addEventListener("mousedown", (e) => { e.stopPropagation(); selectSlot(i); });
    hotbarEl.appendChild(slot);
  });
  refreshHotbar();
}

function refreshHotbar(): void {
  [...hotbarEl.children].forEach((el, i) => {
    const id = HOTBAR[i];
    const n = inventory.get(id);
    el.classList.toggle("active", i === selected);
    el.classList.toggle("empty", !CREATIVE && n === 0);
    (el.querySelector(".count") as HTMLElement).textContent = CREATIVE ? "" : n > 0 ? String(n) : "";
  });
}

function selectSlot(i: number): void {
  if (i < 0 || i >= HOTBAR.length) return;
  selected = i;
  refreshHotbar();
  flashName(def(HOTBAR[i]).name);
}

inventory.onChange = refreshHotbar;
buildHotbarUI();

input.onPlace = () => {
  const id = HOTBAR[selected];
  if (!inventory.has(id)) {
    const slot = hotbarEl.children[selected] as HTMLElement;
    slot.classList.remove("shake");
    void slot.offsetWidth; // إعادة تشغيل الأنيميشن
    slot.classList.add("shake");
    return;
  }
  if (player.placeBlock(id)) inventory.consume(id);
};
input.onSelect = selectSlot;
input.onWheel = (dir) => selectSlot((selected + dir + HOTBAR.length) % HOTBAR.length);

window.addEventListener("keydown", (e) => {
  if (e.code === "F3") {
    e.preventDefault();
    debugEl.classList.toggle("on");
  }
});

/* ---------- حلقة اللعبة ---------- */
let lastTime = performance.now();
let fpsAcc = 0, fpsFrames = 0, fps = 0;

function animate(): void {
  requestAnimationFrame(animate);

  const now = performance.now();
  const rawDt = (now - lastTime) / 1000;
  const dt = Math.min(rawDt, 0.05);
  lastTime = now;

  fpsAcc += rawDt; fpsFrames++;
  if (fpsAcc >= 0.5) { fps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }

  if (input.locked) {
    player.update(dt);
    input.update(dt);
    mining.update(dt, input.mouseButton === 0);
  } else {
    highlight.hide();
  }
  particles.update(dt);

  gr.camera.position.copy(player.eyePosition());
  gr.camera.rotation.y = input.yaw;
  gr.camera.rotation.x = input.pitch;

  for (const cm of chunkMeshes.values()) cm.update();
  ensureAroundLoaded(player.pos.x, player.pos.z);

  if (debugEl.classList.contains("on")) {
    const p = player.pos;
    debugEl.textContent = `FPS ${fps}  |  XYZ ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  |  Chunks ${chunkMeshes.size}`;
  }

  gr.renderer.render(gr.scene, gr.camera);
}

animate();