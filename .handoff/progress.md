# Nhật ký & trạng thái — Backend

> Cập nhật file này cuối mỗi phiên. Mục quan trọng nhất: **Trạng thái hiện tại** + **Việc kế tiếp**.

## Trạng thái hiện tại

🟢 **DEPLOY LIVE:** Neon (Postgres) + **Render** (BE) + Vercel (FE). Admin
`admin@system.local` / `Test@123456` đăng nhập OK. **213 test PASS**, coverage ~83% (floor 80/80/82/80,
CI chạy `test:coverage`). Nhánh `dev` đồng bộ `origin/dev`.

✅ **Đợt 1 (Tags + ActivityLog) đã xong & push.** **Đợt 2 chỉ đụng FE — KHÔNG đổi BE** (Kanban tái dùng
endpoint update status có sẵn, BE tự sinh ActivityLog).

⚠️ **Nên làm:** đổi mật khẩu admin mặc định (đang public trong repo); cân nhắc merge `dev → master` rồi
trỏ Render sang `master` cho production ổn định.

**Cấu hình Render (plan Free):** Branch `dev`; Build `npm install --include=dev && npm run build`;
Start `npm run start:prod`. Env: `DATABASE_URL` (Neon, `?sslmode=require`), `JWT_SECRET` (≥32),
`NODE_ENV=production`, `CORS_ORIGIN` = URL FE Vercel (khớp **chính xác**, không `/` cuối).

**Bài học deploy (đọc trước khi deploy lại):**
1. **Luôn commit + push trước khi deploy.** Render kéo `origin/dev`; code chưa push → `Missing script`.
2. **`NODE_ENV=production` làm `npm install` bỏ devDeps** (`tsc`/`tsc-alias`/`prisma`) → build/migrate
   fail. Fix: Build Command thêm **`--include=dev`**.
3. **ESM `ERR_MODULE_NOT_FOUND './app'`**: `type:module` + `moduleResolution:bundler` → tsc emit import
   KHÔNG có `.js`. Fix: `tsc-alias ... --resolve-full-paths` (đã có trong build script).
4. **Render Free KHÔNG có Pre-Deploy/Shell** → migrate qua `start:prod`
   (`prisma migrate deploy && node dist/server.js`); seed chạy **từ local trỏ vào Neon**:
   `DATABASE_URL="<neon-url>" npm run seed` (inline env override `.env`).
5. **CORS khớp chính xác origin** (`corsOrigins.includes(origin)`): browser gửi `Origin` chỉ
   `scheme+host`, không `/` cuối, không path. Sai → 401/CORS.

## Việc kế tiếp — P2

- ⏭️ (tuỳ chọn) integration test supertest cho route tag/activity.
- **Còn lại P2:** Task attachments (upload), AI (`AiHistory`).

## Quyết định

- Test framework: **Vitest** (đồng bộ FE, hợp ESM + alias). Cover unit + integration càng đầy càng tốt.
- CI: typecheck + `test:coverage` (gate) trên `dev` & `master`.

## Lệnh nhanh

- `npm test` · `npm run test:coverage` · `npm run typecheck` · `npm run build`
- Seed: `DATABASE_URL="<neon-url>" npm run seed`

<details><summary>Lịch sử (gọn)</summary>

- **Tags BE** (`25614fe`): catalog CRUD (`/tags`), gắn/gỡ (`/tasks/:id/tags`), task include `tags`, lọc
  `?tagId=`; helper `assertTaskEditable`.
- **ActivityLog BE** (`ae85f1f`): auto-log (TASK_CREATED, STATUS/ASSIGNEE/DEADLINE/PRIORITY_CHANGED,
  TAG_ADDED/REMOVED), `GET /tasks/:id/activities`.
- Hạ tầng test + bộ test BE (Vitest + supertest): unit (utils/jwt/roles/dto/config), service (mock
  prisma), middleware, integration RBAC project/task/comment. CI (typecheck + test:coverage) `dev` & `master`.
- Fix bug `verifyToken` nuốt `TokenExpiredError` → token hết hạn trả đúng `401 "Token has expired"`.

</details>
