import { prisma } from "@/config/prisma";
import {

  user_role,
  user_status,
} from "@/generated/prisma/client.js";
import { generateSalt, hashPassword } from "../utils/password.util.js";

async function seedAdminUser() {
  console.log("\n📝 Seeding admin user...");

  const email = "admin@system.local";
  const defaultPassword = "Admin@123456";

  const existingAdmin = await prisma.users.findUnique({ where: { email } });
  if (existingAdmin){
    console.log('⏭️  Admin user already exists. Skipping.');
    return existingAdmin;
  } 

  
  const salt = generateSalt();
  const hashedPassword = await hashPassword(defaultPassword, salt);

  const adminUser = await prisma.users.create({
    data: {
      name: "Admin",
      email,
      password_hash: hashedPassword,
      role: user_role.ADMIN,
      status: user_status.ACTIVE,
      must_change_password: true,
      token_version: 0,
    },
  });

  console.log("✅ Default admin user created successfully!");
  console.log("------------------------------------------");
  console.log("Username: admin");
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
