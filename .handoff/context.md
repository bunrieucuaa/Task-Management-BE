# Backend — Ngữ cảnh kỹ thuật

> Repo: `task-be` → GitHub `bunrieucuaa/Task-Management-BE`. Nhánh chính: `dev`, `master`.

## Stack

- **Runtime:** Node 20+/22, TypeScript 5.8, ESM (`"type": "module"`).
- **Framework:** Express 4.21.
- **ORM:** Prisma 7 + PostgreSQL (`@prisma/adapter-pg`). Client được **generate vào
  `src/generated/prisma`** (đã commit), import qua alias `@/generated/prisma/...`.
- **Auth:** JWT (`jsonwebtoken`) + bcrypt. Validate input bằng Zod.
- **Bảo mật:** helmet, cors (allowlist), morgan.
- **Path alias:** `@/*` → `src/*` (xem `tsconfig.json`).

## Kiến trúc (luồng request)

```
routes/*.route.ts  →  controllers/*.controller.ts  →  services/*.service.ts  →  prisma
                          │                                  │
                   map ServiceError → HTTP            ném ServiceError(codeKey)
middlewares/auth.middleware.ts (authenticate, authorize) bảo vệ route
middlewares/error.middleware.ts là global error handler cuối cùng
```

- **`config/index.ts`** — fail-fast: ném lỗi ngay khi khởi động nếu thiếu `JWT_SECRET`
  hoặc secret yếu/mẫu (< 32 ký tự hoặc nằm trong blacklist). **Test phải set
  `JWT_SECRET` mạnh trước khi import bất kỳ module nào kéo theo `config`.**
- **`constants/response-codes.constant.ts`** — bảng mã: key → `{ code, httpStatus, message }`.
- **`shared/errors/service-error.ts`** — `ServiceError(codeKey, message?)`; `resolveError()`
  quy mọi throw về `{ codeKey, message }`. Controller dùng để map ra HTTP status.
- **`shared/auth/roles.ts`** — `isAdmin`, `isPM`, `isPrivileged` (ADMIN hoặc PM).
- **`dtos/api-response.dto.ts`** — `createSuccessResponse`, `createErrorResponse`, `getHttpStatus`.

## Domain & phân quyền (logic cần nhớ khi test)

- **Roles:** `ADMIN`, `PM`, `MEMBER`. `PRIVILEGED = ADMIN | PM`.
- **User status:** `ACTIVE`, `INACTIVE`, `BLOCKED`. Login chặn `INACTIVE`.
- **Token revocation mềm:** mỗi user có `tokenVersion`; đổi mật khẩu / đổi role /
  block / logout đều `increment` → token cũ bị vô hiệu (middleware so khớp version).
- **`mustChangePassword`:** user mới được tạo mật khẩu tạm + cờ này = true. Middleware
  chỉ cho qua endpoint `/change-password` đến khi đổi.
- **Project:** đọc được nếu privileged / owner / member. Quản lý (sửa/xoá/thêm-bớt member)
  chỉ owner hoặc privileged. Xoá = soft delete (status ARCHIVED). Không thể xoá owner khỏi member.
- **Task:** đọc theo quyền project; sửa = creator / assignee / privileged; xoá = creator / privileged.
  Assignee phải là member của project.
- **Comment:** ai đọc được task thì comment được; xoá = tác giả / privileged.

## Gotchas

- ESM + alias: chạy bằng `tsx` (dev) / `tsc` + `tsc-alias` (build). Vitest resolve alias
  qua `resolve.alias` trong `vitest.config.ts`.
- `prisma` được import từ `@/config/prisma` ở mọi service → mock đúng path này trong test.
- `error.middleware.ts` đọc `err.statusCode` (không phải codeKey) và in stack khi
  `NODE_ENV=development`.
- Một số message lỗi bằng tiếng Việt (vd login), một số tiếng Anh — test phải khớp đúng chuỗi.

## Lệnh thường dùng

```bash
npm run dev        # nodemon + tsx
npm run build      # tsc + tsc-alias
npm run typecheck  # tsc --noEmit
npm run seed       # tsx src/seeds/seed.ts
npm test           # vitest (xem testing.md)
```
