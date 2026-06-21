# Nhật ký & trạng thái — Backend

> Cập nhật file này cuối mỗi phiên. Mục quan trọng nhất: **Trạng thái hiện tại** + **Việc kế tiếp**.

## Trạng thái hiện tại

🟢 **DEPLOY LIVE (2026-06-21):** Neon (Postgres) + **Render** (BE) + Vercel (FE). Admin
`admin@system.local` / `Test@123456` đăng nhập OK. **194 test PASS**, coverage ~83% (floor 80/80/82/80,
CI chạy `test:coverage`). P0 (PM bị khoá do `/auth/me`) + P1 (dọn log) đã xong.

**Cấu hình Render (plan Free):** Branch `dev`; Build `npm install --include=dev && npm run build`;
Start `npm run start:prod`. Env: `DATABASE_URL` (Neon, `?sslmode=require`), `JWT_SECRET` (≥32),
`NODE_ENV=production`, `CORS_ORIGIN` = URL FE Vercel (khớp **chính xác**, không `/` cuối).

**Bài học deploy (lỗi đã gặp & fix) — đọc trước khi deploy lại:**
1. **Luôn commit + push trước khi deploy.** Render kéo `origin/dev`; code chưa push → `Missing script`.
2. **`NODE_ENV=production` làm `npm install` bỏ devDeps** (`tsc`/`tsc-alias`/`prisma`) → build/migrate
   fail. Fix: Build Command thêm **`--include=dev`**.
3. **ESM `ERR_MODULE_NOT_FOUND './app'`**: `type:module` + `moduleResolution:bundler` → tsc emit import
   KHÔNG có `.js`. Fix: `tsc-alias ... --resolve-full-paths` (đã có trong build script).
4. **Render Free KHÔNG có Pre-Deploy/Shell** → migrate qua `start:prod`
   (`prisma migrate deploy && node dist/server.js`); seed phải chạy **từ local trỏ vào Neon**:
   `DATABASE_URL="<neon-url>" npm run seed` (Neon mở public, inline env override `.env`).
5. **CORS khớp chính xác origin** (`app.ts` dùng `corsOrigins.includes(origin)`): browser gửi `Origin`
   chỉ `scheme+host`, không `/` cuối, không path. Sai → 401/CORS.

⚠️ **Nên làm:** đổi mật khẩu admin mặc định (đang public trong repo); cân nhắc merge `dev → master`
rồi trỏ Render sang `master` cho production ổn định.

<details><summary>Lịch sử (gọn)</summary>

- Hạ tầng test + bộ test BE (Vitest + supertest): unit (utils/jwt/roles/dto/config), service (mock
  prisma), middleware, integration RBAC project/task/comment đầy đủ → **194 test / 16 file**. CI
  (typecheck + test:coverage) trên push/PR `dev` & `master`.
- Fix bug `verifyToken` nuốt `TokenExpiredError` → token hết hạn trả đúng `401 "Token has expired"`.
- Bật coverage threshold (floor 80/80/82/80).
</details>

## Việc kế tiếp — P2 (có sẵn trong DB schema, chưa implement)

> Bắt đầu đợt này: **Tags + ActivityLog** (2026-06-21).

- **Tags / TaskTag** — model đã có (`tags`, `task_tags` với `@@unique([taskId, tagId])`). Cần:
  CRUD tag + gắn/gỡ tag cho task + lọc task theo tag. (FE dùng dnd-kit cho kéo thả task — xem
  `react-task-managerment/.handoff/`.)
- **ActivityLog** — model đã có (`activity_logs`: `taskId`, `userId`, `action`, `oldValue`/`newValue`
  Json, `createdAt`). Ghi log khi task đổi (create/update status/assignee/...), API liệt kê theo task.
- Còn lại (chưa làm): Task attachments (upload file), AI (`AiHistory`/`AiActionType`).
- (tuỳ chọn) DB integration test thật bằng Testcontainers nếu muốn kiểm Prisma query thật.

## Quyết định

- Test framework: **Vitest** (đồng bộ FE, hợp ESM + alias). Cover unit + integration càng đầy càng tốt.
- CI: typecheck + `test:coverage` (gate) trên `dev` & `master`.

## Lệnh nhanh

- `npm test` · `npm run test:coverage` · `npm run typecheck` · `npm run build`
- Seed: `DATABASE_URL="<neon-url>" npm run seed`
