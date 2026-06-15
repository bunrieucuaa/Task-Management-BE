# API Documentation — Auth & User Management

> **Base URL:** `http://localhost:8080/api/v1`
>
> **Last updated:** 2026-06-02

---

## Mục lục

1. [Response Format](#1-response-format)
2. [Enums](#2-enums)
3. [Authentication](#3-authentication)
4. [Auth APIs](#4-auth-apis)
5. [User Management APIs](#5-user-management-apis-admin)
6. [Flows quan trọng](#6-flows-quan-trọng)

---

## 1. Response Format

Mọi response đều có cùng cấu trúc:

```json
{
  "code": 200,
  "success": true,
  "message": "Request completed successfully",
  "data": { ... }
}
```

**Error response:**

```json
{
  "code": 4001,
  "success": false,
  "message": "Validation error",
  "errors": [
    { "path": ["email"], "message": "Invalid email format" }
  ]
}
```

### HTTP Status Codes

| Code | Ý nghĩa |
|------|----------|
| `200` | Thành công |
| `201` | Tạo mới thành công |
| `400` | Validation error / Invalid input |
| `401` | Chưa đăng nhập / Token hết hạn |
| `403` | Không có quyền / Phải đổi mật khẩu |
| `404` | Không tìm thấy |
| `409` | Trùng lặp (email đã tồn tại) |
| `500` | Lỗi server |

---

## 2. Enums

### UserRole
```
"ADMIN" | "MEMBER"
```

### UserStatus
```
"ACTIVE" | "INACTIVE" | "BLOCKED"
```

---

## 3. Authentication

Tất cả API protected yêu cầu header:

```
Authorization: Bearer <accessToken>
```

- **Access Token** hết hạn sau **1 giờ**
- **Refresh Token** hết hạn sau **7 ngày**
- Khi access token hết hạn → gọi `/auth/refresh` để lấy token mới
- Khi refresh token hết hạn → phải login lại

---

## 4. Auth APIs

### 4.1 Login

```
POST /api/v1/auth/login
```

**Auth:** Không cần

**Request Body:**

```json
{
  "email": "admin@system.local",
  "password": "Test@123456"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | ✅ | Email hợp lệ |
| `password` | string | ✅ | Không rỗng |

**Success Response (200):**

```json
{
  "code": 200,
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "1",
      "name": "Admin",
      "email": "admin@system.local",
      "role": "ADMIN",
      "avatarUrl": "",
      "status": "ACTIVE"
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "mustChangePassword": false
  }
}
```

> [!IMPORTANT]
> **Nếu `mustChangePassword: true`**: FE phải chuyển user đến trang đổi mật khẩu. Mọi API khác (trừ `/auth/change-password`) sẽ trả `403` cho đến khi user đổi mật khẩu.

**Error Responses:**

| HTTP | Khi nào |
|------|---------|
| `401` | Email hoặc password sai |
| `401` | Tài khoản bị INACTIVE |

---

### 4.2 Refresh Token

```
POST /api/v1/auth/refresh
```

**Auth:** Không cần (dùng refreshToken trong body)

**Request Body:**

```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Success Response (200):**

```json
{
  "code": 200,
  "success": true,
  "message": "Access token refreshed",
  "data": {
    "accessToken": "eyJhbGci..."
  }
}
```

**Error Responses:**

| HTTP | Khi nào |
|------|---------|
| `401` | Refresh token không hợp lệ hoặc hết hạn |
| `401` | Token đã bị revoke (user đã logout hoặc bị admin reset password) |

---

### 4.3 Get Me

```
GET /api/v1/auth/me
```

**Auth:** ✅ Bearer Token

**Success Response (200):**

```json
{
  "code": 200,
  "success": true,
  "message": "Request completed successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "admin@system.local",
      "role": "ADMIN",
      "tokenVersion": 0,
      "name": "Admin",
      "avatarUrl": "",
      "status": "ACTIVE"
    }
  }
}
```

---

### 4.4 Change Password

```
POST /api/v1/auth/change-password
```

**Auth:** ✅ Bearer Token

**Request Body:**

```json
{
  "oldPassword": "Test@123456",
  "newPassword": "NewPass@789"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `oldPassword` | string | ✅ | Không rỗng |
| `newPassword` | string | ✅ | 8-128 ký tự |

**Yêu cầu mật khẩu mới:**
- Tối thiểu 8 ký tự
- Tối đa 128 ký tự
- Ít nhất 1 chữ hoa (A-Z)
- Ít nhất 1 chữ thường (a-z)
- Ít nhất 1 số (0-9)
- Ít nhất 1 ký tự đặc biệt (!@#$%^&*...)
- Phải khác mật khẩu cũ

**Success Response (200):**

```json
{
  "code": 200,
  "success": true,
  "message": "Password changed successfully. Please login again.",
  "data": null
}
```

> [!WARNING]
> Sau khi đổi mật khẩu, **tất cả token bị revoke**. FE phải xóa token và chuyển về trang login.

**Error Responses:**

| HTTP | Message | Khi nào |
|------|---------|---------|
| `400` | `Old password is incorrect` | Mật khẩu cũ sai |
| `400` | `New password must be different...` | Mật khẩu mới trùng cũ |
| `400` | `Password must contain...` | Không đạt yêu cầu độ mạnh |

---

### 4.5 Logout

```
POST /api/v1/auth/logout
```

**Auth:** ✅ Bearer Token

**Request Body:** Không cần

**Success Response (200):**

```json
{
  "code": 200,
  "success": true,
  "message": "Logged out successfully",
  "data": null
}
```

> Logout sẽ revoke tất cả token. FE phải xóa `accessToken` và `refreshToken` khỏi storage.

---

## 5. User Management APIs (Admin)

> [!NOTE]
> Các API tạo/list/block/reset/delete user yêu cầu role **ADMIN**. User thường chỉ dùng được Get User (xem chính mình) và Update Profile (sửa chính mình).

### User Object

```typescript
{
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  avatarUrl: string | null;
  mustChangePassword: boolean;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
}
```

> Không bao giờ chứa `passwordHash`, `passwordSalt`, `tokenVersion`.

---

### 5.1 Create User

```
POST /api/v1/users
```

**Auth:** ✅ Bearer Token (ADMIN only)

**Request Body:**

```json
{
  "name": "Nguyen Van A",
  "email": "nguyenvana@example.com",
  "role": "MEMBER"
}
```

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `name` | string | ✅ | — | 1-100 ký tự |
| `email` | string | ✅ | — | Email hợp lệ, unique |
| `role` | string | ❌ | `"MEMBER"` | `"ADMIN"` hoặc `"MEMBER"` |

**Success Response (201):**

```json
{
  "code": 200,
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": 8,
      "name": "Nguyen Van A",
      "email": "nguyenvana@example.com",
      "role": "MEMBER",
      "status": "ACTIVE",
      "avatarUrl": null,
      "mustChangePassword": true,
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-01T10:00:00.000Z"
    },
    "temporaryPassword": "aB3$xYz9!kLm"
  }
}
```

> [!IMPORTANT]
> `temporaryPassword` chỉ trả **1 lần duy nhất**. Admin phải copy và gửi cho user. Nếu mất, dùng API Reset Password.

**Error Responses:**

| HTTP | Khi nào |
|------|---------|
| `400` | Email đã tồn tại |
| `400` | Validation error |
| `403` | Không phải ADMIN |

---

### 5.2 List Users

```
GET /api/v1/users
```

**Auth:** ✅ Bearer Token (ADMIN only)

**Query Parameters:**

| Param | Type | Default | Mô tả |
|-------|------|---------|--------|
| `page` | number | `1` | Trang hiện tại |
| `limit` | number | `20` | Số record/trang (max 100) |
| `search` | string | — | Tìm theo name hoặc email (case-insensitive) |
| `role` | string | — | Filter: `"ADMIN"` hoặc `"MEMBER"` |
| `status` | string | — | Filter: `"ACTIVE"`, `"INACTIVE"`, `"BLOCKED"` |
| `sortBy` | string | `"createdAt"` | `"name"`, `"email"`, `"role"`, `"status"`, `"createdAt"` |
| `sortOrder` | string | `"desc"` | `"asc"` hoặc `"desc"` |

**Ví dụ:**

```
GET /api/v1/users?search=nguyen&role=MEMBER&page=1&limit=10&sortBy=name&sortOrder=asc
```

**Success Response (200):**

```json
{
  "code": 200,
  "success": true,
  "message": "Request completed successfully",
  "data": {
    "data": [
      {
        "id": 3,
        "name": "Nguyen Van A",
        "email": "nguyenvana@example.com",
        "role": "MEMBER",
        "status": "ACTIVE",
        "mustChangePassword": false,
        "avatarUrl": null,
        "createdAt": "2026-06-01T10:00:00.000Z",
        "updatedAt": "2026-06-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### 5.3 Get User by ID

```
GET /api/v1/users/:id
```

**Auth:** ✅ Bearer Token

**Quyền:**
- **ADMIN**: xem bất kỳ user
- **MEMBER**: chỉ xem chính mình (`id` phải trùng với user đang login)

**Success Response (200):**

```json
{
  "code": 200,
  "success": true,
  "message": "Request completed successfully",
  "data": {
    "user": {
      "id": 3,
      "name": "Nguyen Van A",
      "email": "nguyenvana@example.com",
      "role": "MEMBER",
      "status": "ACTIVE",
      "avatarUrl": null,
      "mustChangePassword": false,
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-01T10:00:00.000Z"
    }
  }
}
```

**Error Responses:**

| HTTP | Khi nào |
|------|---------|
| `400` | ID không hợp lệ (không phải số) |
| `403` | Member cố xem user khác |
| `404` | User không tồn tại |

---

### 5.4 Update User Profile

```
PATCH /api/v1/users/:id
```

**Auth:** ✅ Bearer Token

**Quyền:** Chỉ user tự sửa chính mình (`id` phải trùng với user đang login)

**Request Body:**

```json
{
  "name": "Nguyen Van A Updated"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ❌ | 1-100 ký tự |
| `avatarUrl` | string \| null | ❌ | URL hợp lệ hoặc `null` để xóa |

> Ít nhất 1 field phải được cung cấp.

**Success Response (200):**

```json
{
  "code": 200,
  "success": true,
  "message": "User updated successfully",
  "data": {
    "user": {
      "id": 3,
      "name": "Nguyen Van A Updated",
      "email": "nguyenvana@example.com",
      "role": "MEMBER",
      "status": "ACTIVE",
      "mustChangePassword": false,
      "avatarUrl": null,
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-01T12:00:00.000Z"
    }
  }
}
```

**Error Responses:**

| HTTP | Khi nào |
|------|---------|
| `400` | Validation error / Không có field nào |
| `403` | Cố sửa user khác |

---

### 5.5 Update User Status

```
PATCH /api/v1/users/:id/status
```

**Auth:** ✅ Bearer Token (ADMIN only)

**Request Body:**

```json
{
  "status": "BLOCKED"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `status` | string | ✅ | `"ACTIVE"`, `"INACTIVE"`, `"BLOCKED"` |

**Success Response (200):**

```json
{
  "code": 200,
  "success": true,
  "message": "User status updated successfully",
  "data": {
    "user": {
      "id": 3,
      "name": "Nguyen Van A",
      "email": "nguyenvana@example.com",
      "role": "MEMBER",
      "status": "BLOCKED",
      "avatarUrl": null,
      "mustChangePassword": false,
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-01T14:00:00.000Z"
    }
  }
}
```

> [!WARNING]
> Khi status chuyển sang `BLOCKED`, tất cả token của user đó bị revoke ngay lập tức.

**Error Responses:**

| HTTP | Khi nào |
|------|---------|
| `400` | Validation error |
| `403` | Admin tự block chính mình |
| `403` | Không phải ADMIN |

---

### 5.6 Reset User Password

```
POST /api/v1/users/:id/reset-password
```

**Auth:** ✅ Bearer Token (ADMIN only)

**Request Body:** Không cần

**Success Response (200):**

```json
{
  "code": 200,
  "success": true,
  "message": "Password reset successfully. User must change password on next login.",
  "data": {
    "user": {
      "id": 3,
      "name": "Nguyen Van A",
      "email": "nguyenvana@example.com",
      "role": "MEMBER",
      "status": "ACTIVE",
      "avatarUrl": null,
      "mustChangePassword": true,
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-01T15:00:00.000Z"
    },
    "temporaryPassword": "xK9$mNp2!qWe"
  }
}
```

> [!IMPORTANT]
> - `temporaryPassword` chỉ trả **1 lần**. Admin phải copy lại.
> - Tất cả token cũ bị revoke → user bị logout ngay.
> - User login lại sẽ thấy `mustChangePassword: true` → bắt buộc đổi mật khẩu.

**Error Responses:**

| HTTP | Khi nào |
|------|---------|
| `403` | Admin tự reset chính mình |
| `404` | User không tồn tại |

---

### 5.7 Delete User (Soft Delete)

```
DELETE /api/v1/users/:id
```

**Auth:** ✅ Bearer Token (ADMIN only)

**Request Body:** Không cần

**Success Response (200):**

```json
{
  "code": 200,
  "success": true,
  "message": "User has been deleted successfully",
  "data": null
}
```

> Soft delete: user bị chuyển sang status `BLOCKED` + revoke tất cả token. User không bị xóa khỏi database.

**Error Responses:**

| HTTP | Khi nào |
|------|---------|
| `400` | ID không hợp lệ |
| `403` | Admin tự xóa chính mình |
| `404` | User không tồn tại |

---

## 6. Flows quan trọng

### 6.1 First Login Flow (User mới được tạo)

```
Admin tạo user → POST /users → nhận temporaryPassword
              ↓
User login → POST /auth/login → nhận mustChangePassword: true
              ↓
FE redirect → Trang đổi mật khẩu
              ↓
User đổi pass → POST /auth/change-password
              ↓
Tất cả token bị revoke → FE xóa token, redirect login
              ↓
User login lại → mustChangePassword: false → Vào app bình thường
```

### 6.2 Token Refresh Flow

```
FE gọi API → nhận 401 (Token expired)
              ↓
FE gọi → POST /auth/refresh { refreshToken }
              ↓
  ┌── Success → Nhận accessToken mới → Retry API gốc
  └── Fail (401) → Refresh token cũng hết hạn → Redirect login
```

### 6.3 Admin Block User Flow

```
Admin block → PATCH /users/:id/status { "BLOCKED" }
              ↓
Token user bị revoke ngay lập tức
              ↓
User đang online → Gọi API tiếp → Nhận 401 "Token has been revoked"
              ↓
FE redirect login → Login lại → 401 "Tài khoản không hoạt động"
```

### 6.4 Admin Reset Password Flow

```
User quên mật khẩu → Báo Admin
              ↓
Admin reset → POST /users/:id/reset-password → Nhận temporaryPassword
              ↓
Admin gửi password tạm cho user
              ↓
User login → mustChangePassword: true → Bắt buộc đổi mật khẩu
              ↓
Đổi xong → Login lại bình thường
```

---

## Bảng tổng hợp API

| # | Method | Endpoint | Auth | Role | Mô tả |
|---|--------|----------|------|------|--------|
| 1 | POST | `/auth/login` | ❌ | — | Đăng nhập |
| 2 | POST | `/auth/refresh` | ❌ | — | Refresh access token |
| 3 | GET | `/auth/me` | ✅ | ALL | Lấy thông tin user đang login |
| 4 | POST | `/auth/change-password` | ✅ | ALL | Đổi mật khẩu |
| 5 | POST | `/auth/logout` | ✅ | ALL | Đăng xuất |
| 6 | POST | `/users` | ✅ | ADMIN | Tạo user mới |
| 7 | GET | `/users` | ✅ | ADMIN | Danh sách users (phân trang) |
| 8 | GET | `/users/:id` | ✅ | ALL* | Xem user (Admin: all, Member: self) |
| 9 | PATCH | `/users/:id` | ✅ | ALL* | Sửa profile (chỉ self) |
| 10 | PATCH | `/users/:id/status` | ✅ | ADMIN | Block/Unblock user |
| 11 | POST | `/users/:id/reset-password` | ✅ | ADMIN | Reset mật khẩu |
| 12 | DELETE | `/users/:id` | ✅ | ADMIN | Xóa user (soft delete) |

---

## Test Accounts (Seed Data)

| Email | Password | Role | Status |
|-------|----------|------|--------|
| `admin@system.local` | `Test@123456` | ADMIN | ACTIVE |
| `nguyenvana@example.com` | `Test@123456` | MEMBER | ACTIVE |
| `tranthib@example.com` | `Test@123456` | MEMBER | ACTIVE (mustChangePassword) |
| `levanc@example.com` | `Test@123456` | MEMBER | ACTIVE |
| `phamthid@example.com` | `Test@123456` | MEMBER | INACTIVE |
| `hoangvane@example.com` | `Test@123456` | MEMBER | BLOCKED |
