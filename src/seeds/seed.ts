import { prisma } from "@/config/prisma";
import {
  UserRole,
  UserStatus,
} from "@/generated/prisma/client.js";
import { generateSalt, hashPassword } from "../utils/password.util.js";

const DEFAULT_PASSWORD = "Test@123456";

interface SeedUser {
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
}

const seedUsers: SeedUser[] = [
  // ===== ADMIN =====
  {
    name: "Admin",
    email: "admin@system.local",
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    mustChangePassword: false,
  },
  {
    name: "Admin Inactive",
    email: "admin.inactive@system.local",
    role: UserRole.ADMIN,
    status: UserStatus.INACTIVE,
    mustChangePassword: false,
  },

  // ===== MEMBER - ACTIVE =====
  {
    name: "Nguyen Van A",
    email: "nguyenvana@example.com",
    role: UserRole.MEMBER,
    status: UserStatus.ACTIVE,
    mustChangePassword: false,
  },
  {
    name: "Tran Thi B",
    email: "tranthib@example.com",
    role: UserRole.MEMBER,
    status: UserStatus.ACTIVE,
    mustChangePassword: true, // chưa đổi mật khẩu
  },
  {
    name: "Le Van C",
    email: "levanc@example.com",
    role: UserRole.MEMBER,
    status: UserStatus.ACTIVE,
    mustChangePassword: false,
  },

  // ===== MEMBER - INACTIVE =====
  {
    name: "Pham Thi D",
    email: "phamthid@example.com",
    role: UserRole.MEMBER,
    status: UserStatus.INACTIVE,
    mustChangePassword: false,
  },

  // ===== MEMBER - BLOCKED =====
  {
    name: "Hoang Van E",
    email: "hoangvane@example.com",
    role: UserRole.MEMBER,
    status: UserStatus.BLOCKED,
    mustChangePassword: false,
  },
];

async function seedAllUsers() {
  console.log("\n📝 Seeding users...\n");

  const salt = generateSalt();
  const hashedPassword = await hashPassword(DEFAULT_PASSWORD, salt);

  let created = 0;
  let skipped = 0;

  for (const seedUser of seedUsers) {
    const existing = await prisma.user.findUnique({
      where: { email: seedUser.email },
    });

    if (existing) {
      console.log(`⏭️  ${seedUser.email} already exists. Skipping.`);
      skipped++;
      continue;
    }

    const user = await prisma.user.create({
      data: {
        name: seedUser.name,
        email: seedUser.email,
        passwordHash: hashedPassword,
        passwordSalt: salt,
        role: seedUser.role,
        status: seedUser.status,
        mustChangePassword: seedUser.mustChangePassword,
        tokenVersion: 0,
      },
    });

    console.log(
      `✅ Created: ${user.email} | Role: ${seedUser.role} | Status: ${seedUser.status} | ID: ${user.id}`
    );
    created++;
  }

  console.log("\n------------------------------------------");
  console.log(`📊 Summary: ${created} created, ${skipped} skipped`);
  console.log(`🔑 Default password for all users: ${DEFAULT_PASSWORD}`);
  console.log("------------------------------------------\n");

  console.log("📋 Test accounts:");
  console.log("┌─────────────────────────────────────────────────────────┐");
  console.log("│ Email                          │ Role   │ Status       │");
  console.log("├─────────────────────────────────────────────────────────┤");
  for (const u of seedUsers) {
    const email = u.email.padEnd(30);
    const role = u.role.padEnd(6);
    const status = u.status.padEnd(12);
    console.log(`│ ${email} │ ${role} │ ${status} │`);
  }
  console.log("└─────────────────────────────────────────────────────────┘");
}

async function main() {
  await seedAllUsers();
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
