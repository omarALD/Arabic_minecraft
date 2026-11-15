/* =========================================================
   core.ts — الثوابت + الأنواع + تعريف المكعبات
   لا يستورد من أي ملف آخر.
   ========================================================= */

/* ---------- ثوابت ---------- */
export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const RENDER_DISTANCE = 3; // بالـ chunks
export type BlockId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE = 1.62;

export const GRAVITY = 26;
export const JUMP_SPEED = 8.6;
export const WALK_SPEED = 4.8;
export const SPRINT_SPEED = 8.5;

export const REACH = 8; // مسافة الكسر/الوضع

/** true = مكعبات لا نهائية للوضع (بدون مخزون) */
export const CREATIVE = false;

/* ---------- أنواع ---------- */
// عند إضافة مكعب جديد: وسّع هذا النوع + BLOCKS + HOTBAR (+ بلاطة في atlas.ts)
export type BlockId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface BlockDef {
  id: BlockId;
  name: string;
  /** ترتيب النسيج لكل وجه: [+X, -X, +Y, -Y, +Z, -Z] */
  tiles: [number, number, number, number, number, number];
  /** لون التمثيل (الجزيئات + الشريط) */
  color: string;
  /** ثواني التكسير */
  hardness: number;
  /** ما يسقط عند الكسر */
  drop: BlockId;
}

/* ---------- المكعبات ---------- */
export const BLOCKS: Record<Exclude<BlockId, 0>, BlockDef> = {
  1: { id: 1, name: "عشب",   tiles: [1, 1, 0, 2, 1, 1], color: "#6ab04c", hardness: 0.6, drop: 2 },
  2: { id: 2, name: "تراب",  tiles: [2, 2, 2, 2, 2, 2], color: "#8a6446", hardness: 0.5, drop: 2 },
  3: { id: 3, name: "حجر",   tiles: [3, 3, 3, 3, 3, 3], color: "#808080", hardness: 1.5, drop: 3 },
  4: { id: 4, name: "خشب",   tiles: [4, 4, 5, 5, 4, 4], color: "#70502e", hardness: 1.0, drop: 4 },
  5: { id: 5, name: "أوراق", tiles: [6, 6, 6, 6, 6, 6], color: "#3e7828", hardness: 0.2, drop: 5 },
  6: { id: 6, name: "رمل",   tiles: [7, 7, 7, 7, 7, 7], color: "#ded0a0", hardness: 0.5, drop: 6 },
  7: { id: 7, name: "ألواح", tiles: [8, 8, 8, 8, 8, 8], color: "#ac8452", hardness: 0.8, drop: 7 },
  8: { id: 8, name: "طوب", tiles: [9, 9, 9, 9, 9, 9], color: "#a0522d", hardness: 1.2, drop: 8 },

};
export const HOTBAR: BlockId[] = [1, 2, 3, 4, 5, 6, 7, 8];
export const HOTBAR: BlockId[] = [1, 2, 3, 4, 5, 6, 7];