# Nhật ký & trạng thái — Backend

> Cập nhật file này cuối mỗi phiên. Mục quan trọng nhất: **Trạng thái hiện tại** + **Việc kế tiếp**.

## 🚀 CHUẨN BỊ DEPLOY — việc cần làm (chốt 2026-06-19, làm trong chat MỚI)

> Hướng deploy đã chốt: **PaaS** — BE lên **Render/Railway** + **managed Postgres**, FE lên
> **Vercel/Netlify** (xem `react-task-managerment/.handoff/`). Test hiện tại coi như ĐỦ; tập trung
> fix dưới đây rồi deploy. Phạm vi đã chốt với user: **P0 + P1** (hoãn P2).

> ✅ **ĐÃ LÀM XONG P0 + P1 + cấu hình deploy (phiên 8, 2026-06-19).** Xem mục "Trạng thái hiện tại".
> 🟢 **ĐÃ DEPLOY LIVE (phiên 9, 2026-06-21):** Neon (Postgres) + Render (BE) + Vercel (FE). Admin
> đăng nhập OK. Stack đang chạy. Bài học deploy ở entry phiên 9.

### P0 — Bug chặn (BE)
- [x] **PM bị khoá khỏi toàn bộ app.** `src/routes/auth.route.ts:21`:
  `router.get('/me', authenticate, authorize(UserRole.ADMIN, UserRole.MEMBER), getMeHandler)` —
  **thiếu PM** → PM gọi `/auth/me` bị **403** → interceptor FE tự logout khi gặp 403 → PM không
  đăng nhập nổi. `/me` là "của chính mình", không nên gate theo role. **Fix:** bỏ `authorize(...)`
  → `router.get('/me', authenticate, getMeHandler)`. Thêm test trong `app.integration.spec.ts`:
  PM (token role PM) GET `/auth/me` → **200** (hiện chưa có case này). Kiểm `npm test` + typecheck.

### P1 — Dọn cho production (BE)
- [x] **Bỏ `console.log("Error", errorResponse)` ở `src/controllers/user.controller.ts:86`** (debug
  sót). Các `console.log` trong `seeds/seed.ts` và `server.ts` (startup) thì GIỮ — là CLI/log hợp lệ.

### Cấu hình deploy BE (Render/Railway)
- Start: `npm run start` (`node dist/server.js`); build: `npm run build` (`tsc && tsc-alias`).
- **Migrate khi release:** chạy `npx prisma migrate deploy` (KHÔNG dùng `migrate dev`/`reset` ở prod).
  Cân nhắc thêm script `"start:prod": "prisma migrate deploy && node dist/server.js"` hoặc release
  command của platform. Seed admin lần đầu: `npm run seed` (đổi mật khẩu mặc định ngay sau đó).
- Env bắt buộc: **`DATABASE_URL`** (managed Postgres), **`JWT_SECRET`** (≥32 ký tự mạnh — app
  fail-fast nếu yếu), **`CORS_ORIGIN`** = URL FE production, `PORT` (platform tự cấp → `config` đọc
  `process.env.PORT`, kiểm lại), `NODE_ENV=production`. `REDIS_*` trong `.env.example` HIỆN KHÔNG
  dùng → bỏ qua hoặc xoá khỏi example cho gọn.
- Thêm **`engines.node`** vào `package.json` (vd `">=20 <23"`) để platform chọn đúng Node. Healthcheck
  platform trỏ tới **`GET /health`** (đã có).
- `docker-compose.yml` hiện chỉ chạy Postgres (dev). `Dockerfile` đang **rỗng** — KHÔNG cần cho PaaS,
  bỏ qua (hoặc xoá để khỏi nhầm).

### P2 — HOÃN (có trong DB schema nhưng chưa implement)
AI (`AiHistory`/`AiActionType`), Task attachments, Tags/TaskTag, ActivityLog. Để sau khi deploy.

---

## Trạng thái hiện tại

- 2026-06-21 (phiên 9): 🟢 **DEPLOY LIVE** — Neon (Postgres) + **Render** (BE) + Vercel (FE). Admin
  `admin@system.local` / `Test@123456` đăng nhập OK qua FE production.
  **Cấu hình Render (plan Free):** Branch `dev`; Build `npm install --include=dev && npm run build`;
  Start `npm run start:prod`. Env: `DATABASE_URL` (Neon, `?sslmode=require`), `JWT_SECRET` (≥32),
  `NODE_ENV=production`, `CORS_ORIGIN` = URL FE Vercel (khớp **chính xác**, không `/` cuối).
  **Bài học (lỗi đã gặp & fix):**
  1. **Toàn bộ deploy-prep phiên 8 chưa từng commit/push** → Render kéo `origin/dev` cũ, báo
     `Missing script "start:prod"`. Fix: commit + push (`719b45e`). *Luôn push trước khi deploy.*
  2. **`NODE_ENV=production` làm `npm install` bỏ devDeps** (`tsc`/`tsc-alias`/`prisma`) → build/migrate
     fail. Fix: Build Command thêm **`--include=dev`**.
  3. **ESM `ERR_MODULE_NOT_FOUND './app'`**: `type:module` + `moduleResolution:bundler` → tsc emit
     import KHÔNG có `.js`, Node runtime bắt buộc có. Fix: `tsc-alias ... **--resolve-full-paths**`
     (đã sửa trong `package.json` build script).
  4. **Render Free KHÔNG có Pre-Deploy Command** → chạy migrate qua `start:prod`
     (`prisma migrate deploy && node dist/server.js`). `prisma.config.ts` đọc `DATABASE_URL` từ env → OK.
  5. **Render Free KHÔNG có Shell** → không seed được trên server. **Seed từ máy local trỏ vào Neon:**
     `DATABASE_URL="<neon-url>" npm run seed` (Neon mở public, inline env override `.env`).
  6. **CORS phải khớp chính xác origin** (`app.ts` dùng `corsOrigins.includes(origin)`): browser gửi
     `Origin` chỉ `scheme+host`, không `/` cuối, không path. Sai định dạng → 401/CORS.
  ⚠️ **Còn lại nên làm:** đổi mật khẩu admin mặc định (đang public trong repo); cân nhắc merge
  `dev → master` rồi trỏ Render/Vercel sang `master` cho production ổn định.
- 2026-06-19 (phiên 8): ✅ **CHUẨN BỊ DEPLOY — P0 + P1 + cấu hình (BE).**
  - **P0 (TDD):** bỏ `authorize(ADMIN, MEMBER)` khỏi `GET /auth/me` (`src/routes/auth.route.ts`) →
    `/me` chỉ cần `authenticate`. Thêm test trong `app.integration.spec.ts`: PM GET `/me` → **200**
    (trước fix là 403, đã xem test đỏ trước khi sửa). Bỏ luôn import `authorize`/`UserRole` thừa.
  - **P1:** xoá `console.log("Error", ...)` ở `user.controller.ts` (`listUsersHandler`).
  - **Cấu hình deploy:** thêm script **`start:prod`** = `prisma migrate deploy && node dist/server.js`;
    thêm **`engines.node` `">=20 <23"`** vào `package.json`; xoá block **`REDIS_*`** không dùng khỏi
    `.env.example`; **xoá `Dockerfile` rỗng** (giữ `docker-compose.yml` cho dev Postgres).
    `config.port` đã đọc `process.env.PORT` sẵn (OK cho Render/Railway), `GET /health` đã có.
  - **Kiểm chứng:** `npm test` **194 PASS** (tăng từ 193, +1 case PM), `typecheck` sạch, `build` exit 0.
  - **Còn lại (vận hành):** đặt `CORS_ORIGIN` = URL FE thật sau khi FE deploy; seed admin lần đầu.
- 2026-06-19 (phiên 7): ✅ **Bật coverage threshold**. Thêm `coverage.thresholds` vào
  `vitest.config.ts` (floor: stmts 80 / branch 80 / funcs 82 / lines 80 — dưới mức hiện tại
  ~83% vài điểm để CI không đỏ) và đổi bước test trong CI sang `npm run test:coverage` để ngưỡng
  thực sự gate. `test:coverage` exit 0. Coverage hiện tại: **83.23% stmts / 83.55% branch /
  87.61% funcs / 83.23% lines**.
- 2026-06-19 (phiên 6): ✅ **Sửa bug `verifyToken`** (TDD). `jwt.util.ts` export 2 lớp lỗi
  `TokenExpiredError`/`InvalidTokenError` (giữ message tiếng Việt); `auth.middleware.ts` check
  `instanceof TokenExpiredError` (bỏ `import jwt`) → token hết hạn nay trả đúng `401 "Token has
  expired"` thay vì `"Invalid token"`. Cập nhật test cũ trong `auth.middleware.spec.ts` thành
  assert hành vi đúng. **Tổng: 193 test / 16 file, tất cả PASS**, typecheck + build sạch. (Số test
  không đổi — sửa test sẵn có chứ không thêm.)
- 2026-06-19 (phiên 5): ✅ Thêm 3 nhánh integration (25 → 28 test trong `routes.integration.spec.ts`):
  GET tasks lọc `deadlineFrom`/`deadlineTo` (range gte/lte vào where), GET comments **403** khi
  user không đọc được task cha, addMember **409** khi user đã là thành viên. **Tổng: 193 test /
  16 file, tất cả PASS**, typecheck + build sạch. (Tăng từ 190/16.)
- 2026-06-18 (phiên 4): ✅ Bổ sung 4 nhánh integration (21 → 25 test trong file): DELETE project
  (soft-delete/archive), removeMember chặn xoá owner, GET tasks lọc `status`+`priority`, token
  revocation (tokenVersion lệch → 401). **Tổng: 190 test / 16 file, tất cả PASS**, typecheck sạch.
  (Tăng từ 186/16.)
- 2026-06-18 (phiên 3): ✅ Mở rộng `routes.integration.spec.ts` thêm 6 nhánh (15 → 21 test):
  PATCH project (owner/PM), addMember theo email (201 + 404 khi không có user), PATCH task
  (creator), GET tasks `?projectId=` có/không quyền truy cập. **Tổng: 186 test / 16 file, tất
  cả PASS.** typecheck vẫn sạch. (Tăng từ 180/16.)
- 2026-06-18 (phiên 2): ✅ Thêm integration test cho project/task/comment routes
  (`src/routes.integration.spec.ts`, 15 test): RBAC create/manage, project 404/400,
  task access (member vs non-member), comment delete author-vs-privileged, nested route
  `/tasks/:taskId/comments`. **Tổng: 180 test / 16 file, tất cả PASS.** typecheck vẫn sạch.
  (Tăng từ 165/15.)
- 2026-06-18: ✅ Hoàn tất hạ tầng test + bộ test BE. **165 test / 15 file, tất cả PASS.**
  `npm run typecheck` và `npm run build` vẫn sạch (test bị loại khỏi build). CI đã thêm.

## Mục tiêu phiên này

- [x] Cài Vitest + supertest, cấu hình `vitest.config.ts` + setup env.
- [x] Unit test: password.util, jwt.util, roles, service-error, api-response.dto, response-codes, config.
- [x] Service test (mock prisma): auth, user, project, task, comment.
- [x] Middleware test: auth.middleware, error.middleware.
- [x] Integration test (supertest): auth + user RBAC + 404 (full stack).
- [x] GitHub Actions CI (typecheck + test) → `.github/workflows/ci.yml`.

## Quyết định

- Test framework: **Vitest** (đồng bộ với FE, hợp ESM + alias sẵn có). Chốt với user 2026-06-18.
- Mức độ: cover càng đầy đủ càng tốt (unit + integration).
- CI: cơ bản (typecheck + test) trên push/PR vào `dev` & `master`.

## Việc kế tiếp (gợi ý cho phiên sau)

- ~~Integration test cho project/task/comment routes~~ ✅ xong (phiên 2 + mở rộng phiên 3,
  `src/routes.integration.spec.ts`): create RBAC, 404/400, access, nested comments, PATCH
  project/task, addMember theo email, task list `projectId` filter.
- ~~DELETE project (archive), removeMember (chặn xoá owner), lọc task `status`/`priority`,
  token revocation~~ ✅ xong (phiên 4).
- ~~Lọc task theo `deadlineFrom/deadlineTo`, comment list của task không có quyền (403),
  addMember khi user đã là thành viên (409)~~ ✅ xong (phiên 5).
- Có thể thêm DB integration test thật bằng Testcontainers/Postgres nếu muốn kiểm thử Prisma query thật.
- ~~Sửa quirk `verifyToken` nuốt `TokenExpiredError`~~ ✅ xong (phiên 6) — token hết hạn trả đúng
  `"Token has expired"` (xem `testing.md` mục Quirk).
- ~~Bật coverage threshold trong `vitest.config.ts`~~ ✅ xong (phiên 7) — CI chạy `test:coverage`,
  floor 80/80/82/80. Nâng dần khi coverage tăng (đừng đặt trên mức thực tế kẻo CI đỏ).

## Lệnh nhanh

- `npm test` · `npm run test:coverage` · `npm run typecheck`
