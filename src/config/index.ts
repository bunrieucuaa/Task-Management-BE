import dotenv from 'dotenv';

dotenv.config();

/**
 * Lấy biến môi trường bắt buộc. Thiếu → ném lỗi ngay khi khởi động (fail-fast)
 * thay vì âm thầm fallback về giá trị mặc định không an toàn.
 */
const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`[config] Thiếu biến môi trường bắt buộc: ${key}`);
  }
  return value;
};

// Chặn các secret mẫu/yếu lọt vào runtime (kể cả dev) — buộc đặt secret thật.
const WEAK_JWT_SECRETS = new Set([
  'change-this-secret-in-production',
  'your-super-secret-key-change-in-production',
  'your-secret-key-change-this-in-production',
  'secret',
  'jwt-secret',
]);

const jwtSecret = requireEnv('JWT_SECRET');
if (jwtSecret.length < 32 || WEAK_JWT_SECRETS.has(jwtSecret)) {
  throw new Error(
    '[config] JWT_SECRET quá yếu hoặc là giá trị mẫu. Đặt một chuỗi ngẫu nhiên >= 32 ký tự ' +
      '(vd: `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"`).',
  );
}

// Danh sách origin được phép gọi API. Mặc định FE dev (Vite) ở cổng 5173.
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const config = {
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins,
  jwt: {
    secret: jwtSecret,
    accessExpiresInSeconds: 60 * 60, // 1 giờ
    refreshExpiresInSeconds: 7 * 24 * 60 * 60, // 7 ngày
  },
};
