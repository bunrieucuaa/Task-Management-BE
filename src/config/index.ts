import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
//   redis: {
//     host: process.env.REDIS_HOST || 'localhost',
//     port: parseInt(process.env.REDIS_PORT || '6379', 10),
//     password: process.env.REDIS_PASSWORD,
//   },
//   jwt: {
//     secret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
//     expiresIn: process.env.JWT_EXPIRES_IN || '7d',
//   },
};
