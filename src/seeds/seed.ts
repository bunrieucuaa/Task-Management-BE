import { prisma } from "@/config/prisma";
import {
  UserRole,
  UserStatus,
} from "@/generated/prisma/client.js";
import { generateSalt, hashPassword } from "../utils/password.util.js";

async function seedAdminUser() {
  console.log("\n📝 Seeding admin user...");

  const email = "admin@system.local";
  const defaultPassword = "Admin@123456";

  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  if (existingAdmin){
    console.log('⏭️  Admin user already exists. Skipping.');
    return existingAdmin;
  } 

  
  const salt = generateSalt();
  const hashedPassword = await hashPassword(defaultPassword, salt);

  const adminUser = await prisma.user.create({
    data: {
      name: "Admin",
      email,
      passwordHash: hashedPassword,
      passwordSalt: salt,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
      tokenVersion: 0,
      avatarUrl: "https://media.istockphoto.com/id/814423752/photo/eye-of-model-with-colorful-art-make-up-close-up.jpg?s=612x612&w=0&k=20&c=l15OdMWjgCKycMMShP8UK94ELVlEGvt7GmB_esHWPYE="
    },
  });

  console.log("✅ Default admin user created successfully!");
  console.log("------------------------------------------");
  console.log("Email: admin@system.local");
  console.log("Password: Admin@123456");
  console.log("------------------------------------------");
  console.log("⚠️  IMPORTANT: Change the password after first login!");
  console.log(`User ID: ${adminUser.id}`);

  return adminUser;
}

async function main() {
  await seedAdminUser();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Error seeding database:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
