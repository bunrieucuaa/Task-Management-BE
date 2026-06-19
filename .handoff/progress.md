# Nhật ký & trạng thái — Backend

> Cập nhật file này cuối mỗi phiên. Mục quan trọng nhất: **Trạng thái hiện tại** + **Việc kế tiếp**.

## Trạng thái hiện tại

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
