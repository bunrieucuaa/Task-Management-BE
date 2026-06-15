# Backend Architecture — Express, Middleware, Error Handling, DTO Validation

> Tài liệu giải thích chi tiết kiến trúc backend: từ server khởi động → middleware chain →
> routing → controller → service → Prisma → database, cùng cơ chế error handling và validation.

---

## Mục lục

1. [Kiến trúc tổng quan Backend](#1-kiến-trúc-tổng-quan-backend)
2. [Khởi động Server — Từ file nào chạy trước?](#2-khởi-động-server--từ-file-nào-chạy-trước)
3. [Middleware Chain — Chuỗi "kiểm tra" trước khi vào xử lý](#3-middleware-chain--chuỗi-kiểm-tra)
4. [Routing — Định tuyến request](#4-routing--định-tuyến-request)
5. [Controller Pattern — Nhận request, trả response](#5-controller-pattern--nhận-request-trả-response)
6. [DTO Validation — Zod Schema](#6-dto-validation--zod-schema)
7. [Service Layer — Logic nghiệp vụ](#7-service-layer--logic-nghiệp-vụ)
8. [Prisma ORM — Truy vấn Database](#8-prisma-orm--truy-vấn-database)
9. [Error Handling — Xử lý lỗi](#9-error-handling--xử-lý-lỗi)
10. [Response Code System — Mã phản hồi](#10-response-code-system--mã-phản-hồi)
11. [Type Augmentation — Mở rộng Express Request](#11-type-augmentation--mở-rộng-express-request)
12. [Utilities — Tiện ích dùng chung](#12-utilities--tiện-ích-dùng-chung)
13. [Seed Data — Dữ liệu khởi tạo](#13-seed-data--dữ-liệu-khởi-tạo)
14. [Tổng hợp file liên quan](#14-tổng-hợp-file-liên-quan)

---

## 1. Kiến trúc tổng quan Backend

### Cấu trúc thư mục

```
src/
├── server.ts              ← Entry point: khởi động server
├── app.ts                 ← Cấu hình Express app + middleware
│
├── config/                ← Cấu hình ứng dụng
│   ├── index.ts           ← Biến môi trường (PORT, NODE_ENV)
│   └── prisma.ts          ← Khởi tạo Prisma Client
│
├── routes/                ← Định tuyến URL → Controller
│   ├── index.ts           ← Gom tất cả route groups
│   ├── auth.route.ts      ← /api/v1/auth/*
│   └── user.route.ts      ← /api/v1/users/*
│
├── middlewares/           ← Xử lý trước khi vào Controller
│   ├── auth.middleware.ts  ← authenticate (JWT) + authorize (role)
│   └── error.middleware.ts ← Global error handler
│
├── controllers/           ← Nhận request + validate + gọi service + trả response
│   ├── auth.controller.ts
│   └── user.controller.ts
│
├── services/              ← Logic nghiệp vụ + Prisma queries
│   ├── auth.service.ts
│   └── user.service.ts
│
├── dtos/                  ← Zod schemas validate input
│   ├── api-response.dto.ts ← Helper tạo response chuẩn
│   ├── auth.dto.ts        ← Schemas cho login, change-password, refresh
│   └── user.dto.ts        ← Schemas cho create/update/list user
│
├── constants/             ← Hằng số
│   └── response-codes.constant.ts  ← Mã response + HTTP status
│
├── shared/                ← Dùng chung
│   ├── interfaces/        ← TypeScript interfaces (IAuth, IJwt, IUser)
│   └── types/
│       └── express.d.ts   ← Mở rộng kiểu Request (thêm req.user)
│
├── utils/                 ← Tiện ích
│   ├── jwt.util.ts        ← Tạo/verify JWT token
│   └── password.util.ts   ← Hash/verify/generate password
│
├── seeds/                 ← Dữ liệu khởi tạo
│   └── seed.ts
│
└── generated/             ← Prisma Client tự sinh (KHÔNG sửa tay)
    └── prisma/
```

### Sơ đồ luồng xử lý 1 request

```
Client gửi: POST /api/v1/users  { name: "...", email: "..." }
    │
    ▼
┌── Express App (app.ts) ──────────────────────────────────────┐
│                                                               │
│  ① helmet()          → Bảo mật HTTP headers                  │
│  ② cors()            → Cho phép cross-origin                 │
│  ③ morgan('dev')     → Log request (GET /api/v1/users 200)   │
│  ④ express.json()    → Parse body JSON → req.body            │
│  ⑤ express.urlencoded() → Parse body form                    │
│                                                               │
│  ⑥ app.use('/api/v1', routes)  → Vào hệ thống routing       │
│     │                                                         │
│     ├── /auth/* → auth.route.ts                              │
│     └── /users/* → user.route.ts                             │
│         │                                                     │
│         ▼                                                     │
│  ⑦ authenticate     → Verify JWT token                      │
│  ⑧ authorize(ADMIN) → Kiểm tra role                         │
│  ⑨ controller       → Validate input (Zod) + gọi service    │
│  ⑩ service           → Logic nghiệp vụ + Prisma query       │
│                                                               │
│  Nếu không match URL nào:                                     │
│  ⑪ 404 handler      → { success: false, message: "Route..." }│
│                                                               │
│  Nếu có lỗi không bắt được:                                  │
│  ⑫ errorHandler     → Global error handler                  │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. Khởi động Server — Từ file nào chạy trước?

```
npm run dev
    │
    ▼
nodemon → tsx src/server.ts
    │
    ▼
┌── server.ts ─────────────────────────────────────┐
│                                                   │
│  import app from './app';                         │
│  import { config } from './config/index';         │
│                                                   │
│  app.listen(config.port, () => {                  │
│    console.log("Server running on port 8080");    │
│  });                                              │
└───────────────────────────────────────────────────┘
    │
    ▼
┌── config/index.ts ───────────────────────────────┐
│                                                   │
│  dotenv.config();  → Đọc file .env               │
│                                                   │
│  export const config = {                          │
│    port: process.env.PORT || 8080,                │
│    nodeEnv: process.env.NODE_ENV || 'development' │
│  };                                               │
└───────────────────────────────────────────────────┘
    │
    ▼
┌── config/prisma.ts ──────────────────────────────┐
│                                                   │
│  const adapter = new PrismaPg({ connectionString })│
│  export const prisma = new PrismaClient({ adapter })│
│                                                   │
│  → Kết nối PostgreSQL qua PrismaPg adapter       │
│  → Export singleton `prisma` để dùng ở service    │
└───────────────────────────────────────────────────┘
```

File: [server.ts](../src/server.ts) → [app.ts](../src/app.ts) → [config/index.ts](../src/config/index.ts) → [config/prisma.ts](../src/config/prisma.ts)

---

## 3. Middleware Chain — Chuỗi "kiểm tra"

### Middleware là gì?

Middleware giống **trạm kiểm soát** trên đường cao tốc. Mỗi request phải đi qua TỪNG trạm theo thứ tự. Nếu 1 trạm từ chối → request dừng lại, không đến đích.

### Thứ tự middleware trong app.ts

```ts
// app.ts — THỨ TỰ RẤT QUAN TRỌNG!

// ─── TẦNG 1: Middleware toàn cục (MỌI request đều đi qua) ───
app.use(helmet());                          // ① Bảo mật headers
app.use(cors());                            // ② Cross-origin
app.use(morgan('dev'));                      // ③ Logging
app.use(express.json());                    // ④ Parse JSON body
app.use(express.urlencoded({ extended: true })); // ⑤ Parse form body

// ─── TẦNG 2: Routing (phân luồng theo URL) ───
app.use('/api/v1', routes);                 // ⑥ Vào route system

// ─── TẦNG 3: Fallback (không match route nào) ───
app.use((req, res, next) => {               // ⑦ 404 handler
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── TẦNG 4: Error handler (bắt lỗi toàn cục) ───
app.use(errorHandler);                      // ⑧ Global error handler
```

### Giải thích từng middleware toàn cục

| # | Middleware | Thư viện | Tác dụng |
|---|-----------|---------|----------|
| ① | `helmet()` | helmet | Thêm headers bảo mật: X-Content-Type-Options, X-Frame-Options, Content-Security-Policy... Chống các cuộc tấn công phổ biến |
| ② | `cors()` | cors | Cho phép frontend (localhost:5173) gọi backend (localhost:8080). Không có CORS → trình duyệt sẽ BLOCK request |
| ③ | `morgan('dev')` | morgan | Log mỗi request ra console: `POST /api/v1/auth/login 200 45ms` |
| ④ | `express.json()` | express | Parse `Content-Type: application/json` → `req.body = { email: "...", password: "..." }` |
| ⑤ | `express.urlencoded()` | express | Parse `Content-Type: application/x-www-form-urlencoded` (ít dùng trong API) |

### Middleware per-route (auth)

Ngoài middleware toàn cục, từng route có middleware riêng:

```
 user.route.ts:
 ┌──────────────────────────────────────────────────────────────┐
 │                                                              │
 │  router.use(authenticate);  ← MỌI route /users/* đều qua   │
 │                                                              │
 │  POST /users                                                │
 │    → authenticate → authorize(ADMIN) → createUserHandler    │
 │                                                              │
 │  GET /users                                                 │
 │    → authenticate → authorize(ADMIN) → listUsersHandler     │
 │                                                              │
 │  GET /users/:id                                             │
 │    → authenticate → getUserHandler (check thêm trong code)  │
 │                                                              │
 │  PATCH /users/:id                                           │
 │    → authenticate → updateUserHandler (check req.user.id)   │
 └──────────────────────────────────────────────────────────────┘

 auth.route.ts:
 ┌──────────────────────────────────────────────────────────────┐
 │                                                              │
 │  POST /auth/login     → loginHandler        (KHÔNG cần JWT) │
 │  POST /auth/refresh   → refreshHandler      (KHÔNG cần JWT) │
 │                                                              │
 │  POST /auth/change-password                                 │
 │    → authenticate → changePasswordHandler   (CẦN JWT)       │
 │                                                              │
 │  POST /auth/logout                                          │
 │    → authenticate → logoutHandler           (CẦN JWT)       │
 │                                                              │
 │  GET /auth/me                                               │
 │    → authenticate → authorize(ADMIN, MEMBER) → getMeHandler │
 └──────────────────────────────────────────────────────────────┘
```

### authenticate middleware — Chi tiết từng bước

```
Request đến với header: Authorization: "Bearer eyJhbGciOi..."
    │
    ▼
┌── auth.middleware.ts: authenticate ──────────────────────────┐
│                                                               │
│  ① Đọc header Authorization                                  │
│     └── Không có hoặc không bắt đầu "Bearer "?              │
│         → 401: "Authentication required" ❌                   │
│                                                               │
│  ② Extract token: "Bearer eyJhbG..." → "eyJhbG..."          │
│                                                               │
│  ③ verifyToken(token):                                       │
│     └── jwt.verify(token, JWT_SECRET)                        │
│     └── Token hết hạn? → 401: "Token has expired" ❌          │
│     └── Chữ ký sai?   → 401: "Invalid token" ❌              │
│                                                               │
│  ④ Kiểm tra type === TokenType.Access                        │
│     └── Là Refresh token? → 401: "Access token required" ❌   │
│                                                               │
│  ⑤ getUserById(payload.sub) → query DB                       │
│     └── User không tồn tại? → 401: "User not found" ❌       │
│                                                               │
│  ⑥ Kiểm tra user.status                                     │
│     └── INACTIVE? → 401: "User account is disabled" ❌        │
│                                                               │
│  ⑦ Kiểm tra tokenVersion                                    │
│     └── Token version ≠ DB version?                          │
│         → 401: "Token has been revoked" ❌                    │
│                                                               │
│  ⑧ Kiểm tra mustChangePassword                              │
│     └── mustChangePassword = true                            │
│         VÀ URL không phải /change-password?                  │
│         → 403: "You must change your password" ❌             │
│                                                               │
│  ⑨ Gắn user vào request:                                    │
│     req.user = { id, email, role, tokenVersion, name, ... }  │
│                                                               │
│  ⑩ next() → chuyển tiếp cho middleware/controller tiếp theo  │
└───────────────────────────────────────────────────────────────┘
```

### authorize middleware — Kiểm tra role

```ts
// authorize là 1 higher-order function (hàm trả về hàm)
export const authorize = (...roles: UserRole[]) =>
  (req, res, next) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      → 403: "Forbidden. You do not have the required permissions."
    }
    next();  // Role hợp lệ → tiếp tục
  };

// Sử dụng:
authorize(UserRole.ADMIN)              // Chỉ ADMIN
authorize(UserRole.ADMIN, UserRole.MEMBER)  // ADMIN hoặc MEMBER
```

File: [auth.middleware.ts](../src/middlewares/auth.middleware.ts)

---

## 4. Routing — Định tuyến request

### Cấu trúc routing

```
app.use('/api/v1', routes)
              │
              ▼
┌── routes/index.ts ─────────────────────────────┐
│                                                 │
│  router.use("/auth",  authRoutes);  → /api/v1/auth/*  │
│  router.use("/users", userRoutes);  → /api/v1/users/* │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Bảng tổng hợp tất cả endpoints

**Auth Routes** — [auth.route.ts](../src/routes/auth.route.ts):

| Method | URL | Middleware | Controller | Mô tả |
|--------|-----|-----------|------------|-------|
| POST | `/api/v1/auth/login` | _(none)_ | loginHandler | Đăng nhập |
| POST | `/api/v1/auth/refresh` | _(none)_ | refreshHandler | Gia hạn access token |
| POST | `/api/v1/auth/change-password` | authenticate | changePasswordHandler | Đổi mật khẩu |
| POST | `/api/v1/auth/logout` | authenticate | logoutHandler | Đăng xuất |
| GET | `/api/v1/auth/me` | authenticate + authorize(ALL) | getMeHandler | Lấy user hiện tại |

**User Routes** — [user.route.ts](../src/routes/user.route.ts):

| Method | URL | Middleware | Controller | Mô tả |
|--------|-----|-----------|------------|-------|
| POST | `/api/v1/users` | authenticate + authorize(ADMIN) | createUserHandler | Tạo user |
| GET | `/api/v1/users` | authenticate + authorize(ADMIN) | listUsersHandler | Danh sách users |
| GET | `/api/v1/users/:id` | authenticate | getUserHandler | Xem user (ADMIN hoặc chính mình) |
| PATCH | `/api/v1/users/:id` | authenticate | updateUserHandler | Sửa profile (chỉ chính mình) |
| PATCH | `/api/v1/users/:id/status` | authenticate + authorize(ADMIN) | updateUserStatusHandler | Đổi trạng thái |
| POST | `/api/v1/users/:id/reset-password` | authenticate + authorize(ADMIN) | resetUserPasswordHandler | Reset password |
| DELETE | `/api/v1/users/:id` | authenticate + authorize(ADMIN) | deleteUserHandler | Xóa mềm (BLOCKED) |

---

## 5. Controller Pattern — Nhận request, trả response

### Pattern chung của mọi controller

```ts
export const xxxHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1️⃣  Validate input bằng Zod
    const validation = XxxSchema.safeParse(req.body); // hoặc req.query, req.params
    if (!validation.success) {
      res.status(400).json(createErrorResponse(
        RESPONSE_CODES.VALIDATION_ERROR,
        undefined,
        validation.error.issues,    // ← Zod trả chi tiết lỗi từng field
      ));
      return;
    }

    // 2️⃣  Kiểm tra quyền bổ sung (nếu cần)
    if (req.user!.id !== targetId) {
      res.status(403).json(createErrorResponse(RESPONSE_CODES.FORBIDDEN));
      return;
    }

    // 3️⃣  Gọi service
    const result = await someService(validation.data);

    // 4️⃣  Trả response thành công
    res.status(200).json(createSuccessResponse(result, 'Success message'));

  } catch (error) {
    // 5️⃣  Bắt lỗi từ service → trả error response
    res.status(400).json(createErrorResponse(
      RESPONSE_CODES.INVALID_INPUT,
      error instanceof Error ? error.message : 'Something failed',
    ));
  }
};
```

### Ví dụ thực tế: createUserHandler

```
POST /api/v1/users
body: { name: "Nguyen A", email: "a@example.com", role: "MEMBER" }

    │
    ▼
┌── user.controller.ts: createUserHandler ─────────────────────┐
│                                                               │
│  ① CreateUserSchema.safeParse(req.body)                      │
│     → Zod kiểm tra: name min 1? email hợp lệ? role đúng?   │
│     → Nếu FAIL: trả 400 + validation.error.issues           │
│                                                               │
│  ② createUser(validation.data)                               │
│     → Gọi service: tạo user + sinh password tạm              │
│     → Service throw Error("Email already exists") nếu trùng  │
│                                                               │
│  ③ Thành công:                                               │
│     createSuccessResponse({ user, temporaryPassword })       │
│     res.status(201).json(...)                                │
│                                                               │
│  ④ Nếu service throw Error:                                  │
│     createErrorResponse(RESPONSE_CODES.INVALID_INPUT, ...)   │
│     res.status(400).json(...)                                │
└───────────────────────────────────────────────────────────────┘
```

File: [auth.controller.ts](../src/controllers/auth.controller.ts), [user.controller.ts](../src/controllers/user.controller.ts)

---

## 6. DTO Validation — Zod Schema

### Zod là gì?

Zod là thư viện **validate dữ liệu** tại runtime. Nó giúp kiểm tra dữ liệu từ client có đúng format không TRƯỚC khi xử lý.

### Cách dùng Zod trong dự án

```ts
// 1. Định nghĩa schema (dtos/user.dto.ts)
const CreateUserSchema = z.object({
  name:  z.string().min(1).max(100),       // string, 1-100 ký tự
  email: z.string().email(),               // string, phải là email hợp lệ
  role:  z.nativeEnum(UserRole)            // phải là "ADMIN" | "MEMBER"
           .optional()                      // không bắt buộc
           .default(UserRole.MEMBER),       // mặc định = MEMBER
});

// 2. Validate trong controller
const validation = CreateUserSchema.safeParse(req.body);

if (!validation.success) {
  // validation.error.issues = [
  //   { code: "too_small", path: ["name"], message: "String must contain at least 1 character(s)" },
  //   { code: "invalid_string", path: ["email"], message: "Invalid email" },
  // ]
  return res.status(400).json({ errors: validation.error.issues });
}

// 3. Dùng dữ liệu đã validate (type-safe!)
const { name, email, role } = validation.data;
// TypeScript tự biết: name: string, email: string, role: UserRole
```

### Tất cả Zod Schemas trong dự án

**Auth DTOs** — [auth.dto.ts](../src/dtos/auth.dto.ts):

| Schema | Fields | Dùng ở |
|--------|--------|--------|
| `LoginRequestSchema` | `email` (email), `password` (min 1) | POST /auth/login |
| `ChangePasswordRequestSchema` | `oldPassword` (min 1), `newPassword` (min 8, max 128) | POST /auth/change-password |
| `RefreshTokenRequestSchema` | `refreshToken` (min 1) | POST /auth/refresh |

**User DTOs** — [user.dto.ts](../src/dtos/user.dto.ts):

| Schema | Fields | Dùng ở |
|--------|--------|--------|
| `CreateUserSchema` | `name` (1-100), `email` (email), `role?` (enum, default MEMBER) | POST /users |
| `UpdateUserSchema` | `name?` (1-100), `avatarUrl?` (url, nullable). Ít nhất 1 field | PATCH /users/:id |
| `UpdateUserStatusSchema` | `status` (enum: ACTIVE/INACTIVE/BLOCKED) | PATCH /users/:id/status |
| `ListUsersQuerySchema` | `page?`, `limit?`, `search?`, `role?`, `status?`, `sortBy?`, `sortOrder?` | GET /users |

### Kỹ thuật đặc biệt trong ListUsersQuerySchema

```ts
// Query params từ URL luôn là STRING: ?page="1"&limit="10"
// z.coerce.number() tự convert string → number
page: z.coerce.number().int().min(1).default(1).optional(),

// Empty string "" từ select box → convert thành undefined (bỏ qua filter)
const emptyToUndefined = (val: unknown) => (val === '' ? undefined : val);
role: z.preprocess(emptyToUndefined, z.nativeEnum(UserRole).optional()),
```

---

## 7. Service Layer — Logic nghiệp vụ

### Service làm gì?

Service chứa **logic nghiệp vụ** — phần "thông minh" của backend. Controller chỉ validate và truyền dữ liệu, service quyết định cách xử lý.

### Pattern chung

```
Controller:  "Này service, tạo user với data này"
    │
    ▼
Service:
    ├── Kiểm tra business rules (email trùng? quyền?)
    ├── Xử lý logic (hash password, sinh token, tính phân trang)
    ├── Gọi Prisma để truy vấn/cập nhật database
    ├── Nếu vi phạm rules → throw new Error("message")
    └── Return kết quả cho Controller
```

### Ví dụ: user.service.ts — createUser

```ts
export const createUser = async (dto: CreateUserDto) => {
  // 1. Business rule: email phải unique
  const existing = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existing) {
    throw new Error('Email already exists');  // ← Controller sẽ catch
  }

  // 2. Logic: sinh password tạm thời
  const temporaryPassword = generateRandomPassword();  // "xK9#mP2$"
  const salt = generateSalt();                          // random hex
  const hashedPassword = await hashPassword(temporaryPassword, salt);

  // 3. Prisma: tạo record trong DB
  const user = await prisma.user.create({
    data: {
      name: dto.name,
      email: dto.email,
      role: dto.role,
      passwordHash: hashedPassword,
      passwordSalt: salt,
      mustChangePassword: true,   // buộc đổi pass lần đầu
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    },
  });

  // 4. Return: bỏ sensitive data
  return { user: toUserResponse(user), temporaryPassword };
};
```

### toUserResponse — Loại bỏ dữ liệu nhạy cảm

```ts
// KHÔNG BAO GIỜ trả password ra client!
export const toUserResponse = (user: User): IUserResponse => {
  const { passwordHash, passwordSalt, tokenVersion, ...rest } = user;
  return rest;  // Chỉ trả: id, name, email, role, status, avatarUrl, ...
};
```

### selectSafeUser — Cách khác để bỏ sensitive data

```ts
// Dùng Prisma select: chỉ LẤY các field cần thiết (không lấy password)
export const selectSafeUser = {
  id: true, name: true, email: true, role: true,
  mustChangePassword: true, status: true, avatarUrl: true,
  createdAt: true, updatedAt: true,
  // passwordHash: KHÔNG có → Prisma không query
} as const;

// Sử dụng:
prisma.user.findMany({ select: selectSafeUser, ... });
```

File: [auth.service.ts](../src/services/auth.service.ts), [user.service.ts](../src/services/user.service.ts)

---

## 8. Prisma ORM — Truy vấn Database

### Prisma Client singleton

```ts
// config/prisma.ts
const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });

// Sử dụng trong service:
import { prisma } from "@/config/prisma";
const user = await prisma.user.findUnique({ where: { email } });
```

### Các query pattern phổ biến

```ts
// CREATE
prisma.user.create({ data: { name, email, ... } })

// READ — 1 record
prisma.user.findUnique({ where: { id } })
prisma.user.findUnique({ where: { email } })

// READ — danh sách (phân trang)
prisma.user.findMany({
  where: { ... },           // điều kiện lọc
  select: selectSafeUser,   // chọn fields
  orderBy: { createdAt: 'desc' },
  skip: (page - 1) * limit, // bỏ qua N records
  take: limit,              // lấy N records
})

// COUNT
prisma.user.count({ where: { ... } })

// UPDATE
prisma.user.update({
  where: { id },
  data: { status: 'BLOCKED', tokenVersion: { increment: 1 } },
})

// DELETE (dự án dùng soft delete → update status thay vì delete)
// prisma.user.delete({ where: { id } })  ← KHÔNG dùng
```

### Schema → TypeScript types

Prisma tự sinh TypeScript types từ `schema.prisma`:

```
schema.prisma:
  model User {
    id    Int    @id @default(autoincrement())
    name  String @db.VarChar(100)
    email String @unique @db.VarChar(255)
    role  UserRole? @default(MEMBER)
    ...
  }

        ↓ npx prisma generate

generated/prisma/client.ts:
  interface User {
    id: number;
    name: string;
    email: string;
    role: UserRole | null;
    ...
  }
  
  enum UserRole { ADMIN = "ADMIN", MEMBER = "MEMBER" }
```

File: [prisma.ts](../src/config/prisma.ts), [schema.prisma](../prisma/schema.prisma)

---

## 9. Error Handling — Xử lý lỗi

### 3 tầng xử lý lỗi

```
┌─────────────────────────────────────────────────────────────────┐
│  TẦNG 1: Controller try/catch (xử lý lỗi cục bộ)             │
│                                                                 │
│  try {                                                          │
│    const result = await someService(...);                       │
│    res.json(createSuccessResponse(result));                     │
│  } catch (error) {                                              │
│    // Bắt lỗi từ service (throw new Error(...))                │
│    res.status(400).json(createErrorResponse(                    │
│      RESPONSE_CODES.INVALID_INPUT,                             │
│      error.message,      ← "Email already exists"              │
│    ));                                                          │
│  }                                                              │
├─────────────────────────────────────────────────────────────────┤
│  TẦNG 2: 404 Handler (route không tồn tại)                    │
│                                                                 │
│  app.use((req, res, next) => {                                 │
│    res.status(404).json({                                      │
│      success: false,                                            │
│      message: 'Route not found',                               │
│    });                                                          │
│  });                                                            │
├─────────────────────────────────────────────────────────────────┤
│  TẦNG 3: Global Error Handler (lỗi không được bắt)            │
│                                                                 │
│  app.use(errorHandler);                                        │
│                                                                 │
│  → Bắt mọi lỗi mà controller quên catch                      │
│  → Log err.stack ra console                                    │
│  → Trả 500 + message                                           │
│  → Dev mode: trả thêm stack trace                              │
│  → Prod mode: KHÔNG trả stack (bảo mật)                        │
└─────────────────────────────────────────────────────────────────┘
```

### Global Error Handler chi tiết

```ts
// middlewares/error.middleware.ts
export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);           // Log chi tiết ra server console

  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development'
      ? err.stack        // Dev: trả stack trace để debug
      : undefined,       // Prod: ẩn stack (hacker không thấy code path)
  });
};
```

File: [error.middleware.ts](../src/middlewares/error.middleware.ts)

---

## 10. Response Code System — Mã phản hồi

### Cấu trúc response chuẩn

Mọi API đều trả về cùng 1 format:

```json
// Thành công
{
  "code": 200,
  "success": true,
  "message": "Request completed successfully",
  "data": { ... }
}

// Lỗi validation
{
  "code": 4001,
  "success": false,
  "message": "Validation error",
  "errors": [
    { "code": "too_small", "path": ["name"], "message": "..." }
  ]
}

// Lỗi auth
{
  "code": 4011,
  "success": false,
  "message": "Invalid username or password"
}
```

### Bảng mã response

| Code | Key | HTTP Status | Ý nghĩa |
|------|-----|------------|---------|
| 200 | `SUCCESS` | 200 | Thành công |
| 201 | `CREATED` | 201 | Tạo thành công |
| 4001 | `VALIDATION_ERROR` | 400 | Dữ liệu không hợp lệ |
| 4002 | `INVALID_INPUT` | 400 | Input sai |
| 4011 | `INVALID_CREDENTIALS` | 401 | Sai email/password |
| 4012 | `AUTHENTICATION_REQUIRED` | 401 | Chưa đăng nhập |
| 4013 | `INVALID_TOKEN` | 401 | Token không hợp lệ |
| 4014 | `TOKEN_EXPIRED` | 401 | Token hết hạn |
| 4015 | `MUST_CHANGE_PASSWORD` | 403 | Phải đổi mật khẩu |
| 4031 | `FORBIDDEN` | 403 | Không có quyền |
| 4041 | `USER_NOT_FOUND` | 404 | User không tìm thấy |
| 4091 | `USER_ALREADY_EXISTS` | 409 | Email đã tồn tại |
| 4231 | `ACCOUNT_DISABLED` | 403 | Tài khoản bị vô hiệu |
| 4232 | `ACCOUNT_LOCKED` | 403 | Tài khoản bị khóa |
| 5001 | `INTERNAL_SERVER_ERROR` | 500 | Lỗi server |
| 5002 | `DATABASE_ERROR` | 500 | Lỗi database |
| 5003 | `SERVICE_UNAVAILABLE` | 503 | Service không khả dụng |

### Helper functions

```ts
// Tạo response thành công
createSuccessResponse(data, message?)
// → { code: 200, success: true, message: "...", data }

// Tạo response lỗi
createErrorResponse(RESPONSE_CODES.FORBIDDEN, "Custom message", errors?)
// → { code: 4031, success: false, message: "Custom message" }

// Lấy HTTP status từ code key
getHttpStatus(RESPONSE_CODES.CREATED)  // → 201
```

File: [response-codes.constant.ts](../src/constants/response-codes.constant.ts), [api-response.dto.ts](../src/dtos/api-response.dto.ts)

---

## 11. Type Augmentation — Mở rộng Express Request

### Vấn đề

Express mặc định: `req.user` KHÔNG TỒN TẠI. Nhưng `authenticate` middleware gắn user vào `req.user`. TypeScript sẽ báo lỗi nếu không khai báo.

### Giải pháp: Declaration Merging

```ts
// shared/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: UserRole | null;
        tokenVersion: number;
        name: string;
        avatarUrl?: string | "";
        status: UserStatus;
      };
    }
  }
}
```

Sau khi khai báo, TypeScript hiểu `req.user` có kiểu `{ id, email, role, ... } | undefined`.

```ts
// Trong controller:
if (!req.user) { ... }         // TypeScript OK
const userId = req.user.id;    // TypeScript biết: number
const role = req.user.role;    // TypeScript biết: UserRole | null
```

File: [express.d.ts](../src/shared/types/express.d.ts)

---

## 12. Utilities — Tiện ích dùng chung

### JWT Utility

File: [jwt.util.ts](../src/utils/jwt.util.ts)

```
signAccessToken(payload)    → JWT string (hết hạn 1 giờ)
signRefreshToken(payload)   → JWT string (hết hạn 7 ngày)
verifyToken(token)          → JwtPayload hoặc throw Error
```

| Hằng số | Giá trị | Ý nghĩa |
|---------|---------|---------|
| `JWT_SECRET` | env hoặc fallback | Khóa bí mật ký token |
| `ACCESS_EXPIRES_IN_SECONDS` | 3600 (1 giờ) | Thời gian sống access token |
| `REFRESH_EXPIRES_IN_SECONDS` | 604800 (7 ngày) | Thời gian sống refresh token |

### Password Utility

File: [password.util.ts](../src/utils/password.util.ts)

| Function | Tác dụng |
|----------|----------|
| `generateSalt()` | Tạo salt ngẫu nhiên (16 bytes hex) |
| `generateRandomPassword()` | Sinh mật khẩu 12-16 ký tự (A-Z, a-z, 0-9, special) |
| `hashPassword(password, salt)` | Hash bằng bcrypt (12 rounds) với custom salt |
| `verifyPassword(password, hash, salt)` | So sánh password với hash |
| `validatePasswordStrength(password)` | Kiểm tra: 8-128 ký tự, có uppercase, lowercase, number, special |

Quy trình hash password:
```
password = "MyPass123!"
salt = "a1b2c3d4..."  (random)
saltedPassword = "MyPass123!" + "a1b2c3d4..."  (nối lại)
hash = bcrypt.hash(saltedPassword, 12)          (hash 12 rounds)

Verify: bcrypt.compare("MyPass123!" + "a1b2c3d4...", hash) → true/false
```

---

## 13. Seed Data — Dữ liệu khởi tạo

File: [seed.ts](../src/seeds/seed.ts)

```bash
# Chạy seed
npm run seed
# hoặc
npx prisma db seed
```

### Dữ liệu mặc định

| Email | Role | Status | Must Change Password |
|-------|------|--------|---------------------|
| `admin@system.local` | ADMIN | ACTIVE | No |
| `admin.inactive@system.local` | ADMIN | INACTIVE | No |
| `nguyenvana@example.com` | MEMBER | ACTIVE | No |
| `tranthib@example.com` | MEMBER | ACTIVE | **Yes** |
| `levanc@example.com` | MEMBER | ACTIVE | No |
| `phamthid@example.com` | MEMBER | INACTIVE | No |
| `hoangvane@example.com` | MEMBER | BLOCKED | No |

**Password mặc định cho tất cả:** `Test@123456`

---

## 14. Tổng hợp file liên quan

### Core

| File | Vai trò |
|------|---------|
| [server.ts](../src/server.ts) | Entry point — khởi động HTTP server |
| [app.ts](../src/app.ts) | Cấu hình Express app + middleware chain |
| [config/index.ts](../src/config/index.ts) | Biến môi trường (PORT, NODE_ENV) |
| [config/prisma.ts](../src/config/prisma.ts) | Prisma Client singleton |

### Routing

| File | Vai trò |
|------|---------|
| [routes/index.ts](../src/routes/index.ts) | Gom tất cả route groups |
| [routes/auth.route.ts](../src/routes/auth.route.ts) | Endpoints /auth/* |
| [routes/user.route.ts](../src/routes/user.route.ts) | Endpoints /users/* |

### Middleware

| File | Vai trò |
|------|---------|
| [auth.middleware.ts](../src/middlewares/auth.middleware.ts) | authenticate (JWT) + authorize (role) |
| [error.middleware.ts](../src/middlewares/error.middleware.ts) | Global error handler |

### Controllers

| File | Vai trò |
|------|---------|
| [auth.controller.ts](../src/controllers/auth.controller.ts) | Login, refresh, logout, change-password, me |
| [user.controller.ts](../src/controllers/user.controller.ts) | CRUD users + reset password |

### Services

| File | Vai trò |
|------|---------|
| [auth.service.ts](../src/services/auth.service.ts) | Logic auth: login, refresh, logout, change password |
| [user.service.ts](../src/services/user.service.ts) | Logic users: create, list, update, delete, reset password |

### DTOs & Constants

| File | Vai trò |
|------|---------|
| [api-response.dto.ts](../src/dtos/api-response.dto.ts) | Helper tạo response chuẩn |
| [auth.dto.ts](../src/dtos/auth.dto.ts) | Zod schemas cho auth |
| [user.dto.ts](../src/dtos/user.dto.ts) | Zod schemas cho users |
| [response-codes.constant.ts](../src/constants/response-codes.constant.ts) | Bảng mã response + HTTP status |

### Shared & Types

| File | Vai trò |
|------|---------|
| [IAuth.ts](../src/shared/interfaces/IAuth.ts) | Interface login/refresh response |
| [IJwt.ts](../src/shared/interfaces/IJwt.ts) | Interface JWT payload + TokenType enum |
| [IUser.ts](../src/shared/interfaces/IUser.ts) | Interface user response + pagination + SafeUser |
| [express.d.ts](../src/shared/types/express.d.ts) | Mở rộng Express Request (thêm req.user) |

### Utilities

| File | Vai trò |
|------|---------|
| [jwt.util.ts](../src/utils/jwt.util.ts) | Tạo/verify JWT token |
| [password.util.ts](../src/utils/password.util.ts) | Hash/verify/generate password + validate strength |

### Database

| File | Vai trò |
|------|---------|
| [schema.prisma](../prisma/schema.prisma) | Định nghĩa model database |
| [seed.ts](../src/seeds/seed.ts) | Dữ liệu khởi tạo (7 test users) |
