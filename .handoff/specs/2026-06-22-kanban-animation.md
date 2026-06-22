# Spec — Đợt 2: Kanban dnd-kit + Framer Motion (FE)

> Ngày: 2026-06-22. Repo: `react-task-managerment` (chỉ FE — BE đã có sẵn endpoint update
> status + auto ActivityLog từ Đợt 1, **không cần đổi BE**). Theo TDD + pattern sẵn có.
> Tiền đề: Đợt 1 (Tags + ActivityLog) đã xong & push (`origin/dev`).

## Mục tiêu
- **Kanban kéo-thả:** xem task dạng bảng Kanban theo status; kéo card sang cột khác → đổi status.
  Tái dùng endpoint `updateTask({ status })` → BE **tự sinh ActivityLog** (`STATUS_CHANGED`).
- **Framer Motion:** hiệu ứng chuyển trang mượt + hiệu ứng nhỏ khi toggle light/dark.

## Quyết định đã chốt
- **Không thêm route mới.** Kanban là **chế độ xem thứ 2 (view toggle: Bảng ⇄ Kanban)** ngay trên
  trang `Tasks.tsx` → tái dùng toàn bộ filter, data (`items`), phân quyền, `handleQuickUpdate`.
- **Cột = 5 status** theo thứ tự: TODO → IN_PROGRESS → REVIEW → DONE → CANCELLED (dùng nhãn
  `TASK_STATUS_LABELS`).
- **Chỉ task có quyền sửa mới kéo được** (mirror `canEdit`); card không sửa được → không gắn sensor kéo.
- **Optimistic + revert:** đổi status ngay trên UI, gọi `updateTask`; lỗi → revert (BaseApiDataSource
  đã toast lỗi). Dùng lại đúng `handleQuickUpdate` (đã có toast success).
- **dnd-kit** (`@dnd-kit/core` + `sortable` + `utilities`), **không** kéo giữa list bằng index
  (chỉ cần đổi cột/status, không cần sắp xếp thứ tự trong cột → không lưu order ở BE).
- Logic thuần tách ra `src/lib/kanban.ts` (group theo status, resolve drop → status mới) để unit-test
  đầy đủ; component dnd-kit chỉ wiring (jsdom khó test pointer drag thật).

## Triển khai
### `src/lib/kanban.ts` (TDD — pure, test trước)
- `KANBAN_COLUMNS: ETaskStatus[]` (thứ tự cột).
- `groupTasksByStatus(tasks): Record<ETaskStatus, ITask[]>` — đủ 5 bucket kể cả rỗng; bỏ qua status lạ.
- `columnDroppableId(status)` / `isColumnId(id)` / `statusFromColumnId(id)` — id droppable cột (prefix `col:`).
- `resolveStatusChange(activeId, overId, tasks) → { task, status } | null` — overId là id cột hoặc id card
  khác; trả null nếu không đổi / không tìm thấy / status không hợp lệ.

### `src/components/pages/tasks/TaskBoard.tsx` (presentational + dnd)
- Props: `tasks`, `canEdit(task)`, `onStatusChange(task, status)`, `submitting`.
- `DndContext` (PointerSensor + KeyboardSensor) → `onDragEnd` gọi `resolveStatusChange` → `onStatusChange`.
- Mỗi cột = droppable (`columnDroppableId`), header nhãn + đếm số card. Card = draggable (chỉ khi editable),
  hiển thị title, project, assignee, badge tag (dùng `tagColor`), priority.
- `DragOverlay` cho card đang kéo.

### `Tasks.tsx` wiring
- State `view: "table" | "board"` + nút toggle (mặc định `table`). Board render `<TaskBoard>` với
  `items`, `canEdit`, `onStatusChange = (task, status) => handleQuickUpdate(task, { status })`.

### Framer Motion (sau Kanban)
- `src/components/PageTransition.tsx` bọc nội dung route (fade + slide nhẹ), key theo pathname.
  Gắn ở `(app)/route.tsx` quanh `<Outlet/>` (hoặc trong `layout.tsx`).
- Toggle dark/light: animate icon Sun/Moon (rotate/scale) trong `layout.tsx` bằng `motion` + `AnimatePresence`.
- `prefers-reduced-motion`: tôn trọng (Framer `useReducedMotion`) → tắt animation.

## Test (TDD)
- `src/lib/kanban.spec.ts`: KANBAN_COLUMNS đủ & đúng thứ tự; group đúng bucket + cột rỗng + bỏ status lạ;
  id helpers round-trip; resolveStatusChange (đổi cột, cùng cột→null, over card khác→status card đó,
  over null→null, active không tồn tại→null, ép kiểu số/chuỗi).
- `TaskBoard.spec.tsx`: render đủ cột + đếm; card nằm đúng cột theo status; gọi `onStatusChange` khi
  `onDragEnd` (bắn event/đi qua resolveStatusChange); card không editable → không có handle kéo.
- (FE coverage giữ trên floor; `npm run lint` + `npm run build` sạch.)

## Ngoài phạm vi
- Lưu thứ tự card trong cột ở BE (chỉ đổi status). WIP limit. Swimlane theo assignee. Attachments, AI.

## Kiểm chứng hoàn thành
- `npm run test:coverage` (trên floor) + `npm run lint` + `npm run build` sạch.
- Smoke app live: mở Kanban, kéo task TODO → IN_PROGRESS, thấy status đổi + dòng ActivityLog mới;
  toggle dark mode mượt; chuyển trang có transition.
