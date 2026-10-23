// Анхны админыг тохируулна: бүртгүүлсэн хэрэглэгчийн эрхийг ADMIN болгоно.
//   npm run make-admin -- someone@example.com
// DATABASE_URL-ийг .env-ээс уншина (UAT/production DB-д ажиллуулахдаа тухайн URL-ийг өгнө).
import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("И-мэйл хаяг өгнө үү: npm run make-admin -- someone@example.com");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
try {
  const user = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN", status: "ACTIVE" },
    select: { email: true, role: true },
  });
  console.log(`${user.email} → ${user.role}`);
} catch (error) {
  console.error(error.code === "P2025" ? `${email} хэрэглэгч олдсонгүй. Эхлээд бүртгүүлнэ үү.` : error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
