# Backend — Test suite

## Cách chạy

```bash
npm test              # chạy 1 lần (vitest run)
npm run test:watch    # watch mode
npm run test:coverage # kèm coverage (v8) → ./coverage
```

- Runner: **Vitest 3** (`vitest.config.ts`). Môi trường `node`, alias `@` → `src`.
- Env test được set sẵn trong config (`JWT_SECRET` mạnh, `NODE_ENV=test`) để
  `config/index.ts` không fail-fast. **Không cần `.env` để chạy test.**
- File test: `src/**/*.spec.ts` (đặt cạnh source). `tsconfig.json` đã loại trừ
  `**/*.spec.ts` và `src/test/**` khỏi build → `npm run build`/`typecheck` vẫn sạch.

## Helper test (`src/test/`, không lên build)

- **`prisma.mock.ts`** — `createPrismaMock()` tạo Prisma client giả (mọi delegate là
  `vi.fn()`, `$transaction` gọi callback với chính mock). Pattern mock:
  ```ts
  vi.mock('@/config/prisma', async () => {
    const { createPrismaMock } = await import('@/test/prisma.mock');
    const prisma = createPrismaMock();
    return { prisma, default: prisma };
  });
  import { prisma } from '@/config/prisma';
  const db = prisma as unknown as PrismaMock; // rồi db.user.findUnique.mockResolvedValue(...)
  ```
  Dùng dynamic import trong factory để tránh lỗi hoisting của `vi.mock`.
- **`express.mock.ts`** — `mockRequest/mockResponse/mockNext` cho test middleware
  (res.status/json chainable, lưu `statusCode` + `body`).

## Đã cover (193 test, 16 file)

| Lớp | File | Ghi chú |
|-----|------|---------|
| Utils | `utils/password.util.spec.ts` | hash/verify (bcrypt thật), strength, random gen |
| Utils | `utils/jwt.util.spec.ts` | sign/verify access+refresh, hết hạn, sai secret |
| Shared | `shared/auth/roles.spec.ts` | isAdmin/isPM/isPrivileged |
| Shared | `shared/errors/service-error.spec.ts` | ServiceError + resolveError |
| DTO | `dtos/api-response.dto.spec.ts` | success/error envelope, getHttpStatus, integrity |
| DTO | `dtos/validation.spec.ts` | Zod schema auth/user/project/task/comment |
| Config | `config/config.spec.ts` | fail-fast (thiếu/yếu/mẫu), parse CORS |
| Service | `services/*.service.spec.ts` | auth/user/project/task/comment (mock prisma, RBAC, soft-delete, token revocation) |
| Middleware | `middlewares/auth.middleware.spec.ts` | authenticate (token/role/version/mustChangePassword), authorize |
| Middleware | `middlewares/error.middleware.spec.ts` | status/message/stack theo NODE_ENV |
| Integration | `app.integration.spec.ts` | supertest: login/refresh/me/users RBAC/404 (full stack, mock prisma) |
| Integration | `routes.integration.spec.ts` | supertest: project/task/comment routes — create RBAC, 404/400, access checks, nested comments, delete author-vs-privileged, PATCH project/task, addMember theo email (+ **409** đã là thành viên), task list `projectId`/`status`/`priority`/`deadlineFrom`-`deadlineTo` filter, DELETE project (archive), removeMember chặn owner, token revocation, GET comments **403** khi không đọc được task cha |

## Quirk đã phát hiện (chưa sửa, chỉ ghi nhận)

- `utils/jwt.util.ts#verifyToken` chuẩn hoá `TokenExpiredError` thành `Error` thường,
  nên nhánh `instanceof jwt.TokenExpiredError` trong `auth.middleware.ts` **không bao giờ
  chạy** → token hết hạn trả `401 "Invalid token"` thay vì `"Token has expired"`. Vẫn 401
  nên FE refresh hoạt động bình thường. Nếu muốn message chính xác, cần sửa middleware tự
  verify hoặc đừng wrap lỗi trong verifyToken.

## Khi thêm test

- Service mới → theo pattern mock prisma ở trên, assert `db.<model>.<method>.mock.calls`.
- Lỗi nghiệp vụ ném `ServiceError` → assert `rejects.toMatchObject({ codeKey: RESPONSE_CODES.X })`.
- Route mới → thêm case supertest trong `app.integration.spec.ts` (nhớ mock `getUserById`
  qua `db.user.findUnique` cho middleware `authenticate`).
