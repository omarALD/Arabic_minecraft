# AI_HANDOFF.md

لعبة ماينكرافت عربية في المتصفح — Vite + TypeScript + Three.js. مشروع تسلية شخصي، **حافظ على البساطة**.

## الملفات (`src/`)

| الملف | محتواه | يعتمد على |
|---|---|---|
| `core.ts` | ثوابت + أنواع + `BLOCKS` + `HOTBAR` | لا شيء |
| `world.ts` | `Chunk` + `World` (+ حفظ تعديلات اللاعب) | core, generator |
| `generator.ts` | توليد التضاريس والأشجار (دوال نقية) | core |
| `physics.ts` | AABB + تصادم + raycast | core, world (نوع فقط) |
| `atlas.ts` | رسم نسيج المكعبات برمجياً | three |
| `render.ts` | المشهد + mesher + `ChunkMesh` | core, world, atlas |
| `input.ts` | لوحة/فأرة/pointer lock | لا شيء |
| `player.ts` | حركة + كسر/وضع | core, world, physics, input |
| `main.ts` | الربط وحلقة اللعبة فقط | الكل |
| `ui/style.css` | الواجهة | — |

## قواعد خفيفة

1. **`generator.ts` يستورد `Chunk` كنوع فقط** (`import type`) — حتى لا تنشأ حلقة استيراد مع `world.ts`.
2. **`physics.ts` و`input.ts` لا يعرفان Three.js.** إن احتجت ذلك فالمنطق في المكان الخطأ.
3. **`World.getBlock` لا يرمي أبداً** (يُرجع 0 خارج النطاق). `setBlock` لا يولّد chunks.
4. **تعديلات اللاعب** تُحفظ في `World.edits` وتُعاد عند عودة الـ chunk. (في الذاكرة فقط — تضيع عند إعادة تحميل الصفحة.)
5. إذا تجاوز ملف ~400 سطر، قسّمه حينها. ليس قبل.

## إضافة مكعب جديد (4 أماكن)

1. `core.ts`: وسّع `BlockId` + أضف في `BLOCKS` و`HOTBAR`
2. `atlas.ts`: أضف دالة بلاطة + ضعها في مصفوفة `buildAtlas` + زِد `ATLAS_TILE_COUNT`
3. (اختياري) `generator.ts` إن كان يتولد طبيعياً

## أفكار للتطوير

- [ ] حفظ البناء في `localStorage` (تُحفظ `edits` فقط، ليس العالم كله)
- [ ] ماء
- [ ] دورة نهار وليل (لون `scene.background` + `fog`)
- [ ] كهوف (ضوضاء ثلاثية الأبعاد في `generator.ts`)
- [ ] ملف اختبارات (`tests/`) عند الحاجة فقط

## أوامر

```
npm install
npm run dev
npm run build   # tsc + vite
```
