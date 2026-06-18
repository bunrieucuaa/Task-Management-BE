# Nhật ký & trạng thái — Backend

> Cập nhật file này cuối mỗi phiên. Mục quan trọng nhất: **Trạng thái hiện tại** + **Việc kế tiếp**.

## Trạng thái hiện tại

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
- **(ưu tiên kế tiếp)** Còn nhánh chưa cover qua HTTP: DELETE project (archive/soft-delete),
  removeMember (chặn xoá owner), GET tasks lọc theo `status`/`priority`/`deadline`,
  refresh-token revocation (tokenVersion lệch → 401). Theo pattern mock prisma + supertest.
- Có thể thêm DB integration test thật bằng Testcontainers/Postgres nếu muốn kiểm thử Prisma query thật.
- Cân nhắc sửa quirk `verifyToken` nuốt `TokenExpiredError` (xem `testing.md` mục Quirk) nếu
  muốn message "Token has expired" chính xác.
- Bật coverage threshold trong `vitest.config.ts` nếu muốn ép mức cover tối thiểu.

## Lệnh nhanh

- `npm test` · `npm run test:coverage` · `npm run typecheck`
