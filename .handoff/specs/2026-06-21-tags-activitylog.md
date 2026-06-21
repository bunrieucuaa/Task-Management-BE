# Spec — Đợt 1: Tags + ActivityLog (cross-repo BE + FE)

> Ngày: 2026-06-21. Phạm vi: 2 feature P2 đầu tiên. Đợt 2 (animation + dnd-kit Kanban) có spec riêng.
> Repo: `task-be` (BE) + `react-task-managerment` (FE). Theo TDD + pattern sẵn có.

## Mục tiêu
- **Tags (global):** gắn nhãn task bằng danh sách tag dùng chung toàn hệ thống; lọc task theo tag.
- **ActivityLog:** tự động ghi lịch sử thay đổi của task; hiển thị timeline trong dialog task.

## Quyết định đã chốt
- Tags **dùng chung global** (không per-project, không free-form loạn). Schema `Tag.name @unique` giữ nguyên.
- **KHÔNG thêm cột `color`** → màu badge suy ra từ hash tên tag ở FE → **không migration mới** cho đợt này.
- ActivityLog hiển thị **timeline trong dialog task** (không làm trang audit tổng đợt này).
- Phân quyền:
  - Tạo/xoá tag (danh mục): **admin + PM**.
  - Gắn/gỡ tag vào task: **ai có quyền sửa task** đó (creator/assignee/PM/admin — mirror rule task hiện có).
  - Xem activity của task: **ai có quyền xem task** đó.

## Backend (`task-be`) — mirror pattern `comment.*`

### Tags — `tag.service.ts` / `tag.controller.ts` / `tag.route.ts` (đăng ký trong `routes/index.ts`)
- `GET /api/v1/tags` → list tất cả tag (auth). Trả `[{ id, name }]`, sort theo name.
- `POST /api/v1/tags` `{ name }` → tạo tag. Chỉ **admin/PM**. Trùng name → **409**. Validate zod (name 1..100).
- `DELETE /api/v1/tags/:id` → xoá tag. Chỉ **admin**. Cascade `task_tags`. Không tồn tại → **404**.
- `POST /api/v1/tasks/:taskId/tags` `{ tagId }` → gắn tag. Cần quyền sửa task. Đã gắn → **409**. Tag/task không có → **404**.
- `DELETE /api/v1/tasks/:taskId/tags/:tagId` → gỡ tag. Cần quyền sửa task.
- Task detail + list **include** `tags` (qua `taskTags.tag`), trả mảng `tags: [{ id, name }]`.
- Lọc: `GET /api/v1/tasks?tagId=<id>` → where có `taskTags.some({ tagId })`. Kết hợp được với filter sẵn có.

### ActivityLog — ghi tự động trong `task.service`
- Helper ghi log (vd `logActivity(taskId, userId, action, oldValue, newValue)` ghi `activity_logs`).
- Action ghi log (so old vs new khi update):
  - `TASK_CREATED` (lúc tạo task).
  - `STATUS_CHANGED`, `ASSIGNEE_CHANGED`, `DEADLINE_CHANGED`, `PRIORITY_CHANGED`.
  - `TAG_ADDED`, `TAG_REMOVED` (khi gắn/gỡ tag).
- `oldValue`/`newValue` lưu JSON gọn (vd `{ "status": "TODO" }`). `userId` = người thao tác (từ token).
- Ghi trong cùng flow mutation (không tách job). Lỗi ghi log KHÔNG được làm hỏng mutation chính → bọc try/catch, log cảnh báo.
- `GET /api/v1/tasks/:taskId/activities` → list theo task (cần quyền xem task), `createdAt` desc, phân trang (`page`/`limit` như các list khác).

### Test BE (TDD — viết đỏ trước)
- `tag.service.spec.ts` (mock prisma): create (ok/409 trùng), delete (ok/404), list, attach/detach (ok/409/404).
- Logic logging: assert `activity_logs.create` được gọi đúng action + payload khi đổi status/assignee/...
- Integration (`*.integration.spec.ts`): RBAC tạo/xoá tag (admin/PM vs member → 403), gắn/gỡ theo quyền task, lọc `?tagId=`, list activities + quyền xem.

## Frontend (`react-task-managerment`)

### Tags
- `TagRepository` (mirror `CommentRepository`): `list`, `create`, `delete`, `attachToTask`, `detachFromTask`.
- (tuỳ) `tagsSlice` hoặc fold vào `tasksSlice` — chọn slice riêng `tagsSlice` cho danh mục tag.
- **TaskFormDialog:** combobox multi-select gắn/gỡ tag (Radix). Admin/PM tạo tag inline (nhập tên mới → gọi create).
- **Tasks.tsx:** badge tag trên mỗi row; màu badge từ hash tên (util `tagColor(name)`).
- **Lọc theo tag:** dropdown chọn tag → set query `tagId`, refetch.

### ActivityLog
- `ActivityRepository`: `listByTask(taskId, page, limit)`.
- Dialog task: thêm tab/khu **"Lịch sử"** — timeline: mỗi dòng = icon theo action + câu mô tả tiếng Việt
  (vd "đổi trạng thái TODO → IN_PROGRESS") + thời gian tương đối (`date-fns` `formatDistanceToNow`).
- Map action → câu mô tả ở 1 util (vd `describeActivity(activity)`).

### Test FE (TDD)
- `TagRepository.spec.ts`, `ActivityRepository.spec.ts` (mock axios, assert verb/URL/body).
- `tagsSlice.spec.ts` nếu có slice.
- Component: tag combobox trong TaskFormDialog (gắn/gỡ/tạo), badge render trên row, lọc theo tag; timeline render đúng mô tả từ list activity mock.

## Ngoài phạm vi đợt này (để Đợt 2 / sau)
- Kanban kéo-thả (dnd-kit) — kéo đổi status sẽ tái dùng endpoint update status + tự sinh ActivityLog.
- Animation chuyển trang + toggle dark mode (Framer Motion).
- Trang audit tổng, cột `color` cho tag, AI, attachments.

## Kiểm chứng hoàn thành
- BE: `npm test` (thêm test mới) + `npm run typecheck` + `npm run build` sạch.
- FE: `npm run test:coverage` (giữ trên floor) + `npm run lint` + `npm run build` sạch.
- Smoke trên app live: tạo tag, gắn vào task, lọc theo tag, đổi status → thấy dòng lịch sử mới.
