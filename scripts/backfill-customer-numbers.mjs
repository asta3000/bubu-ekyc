// Харилцагчийн дугааргүй (энэ талбар нэмэгдэхээс өмнө бүртгэгдсэн) байгууллагуудад дугаар үүсгэнэ.
//   npm run backfill-customer-numbers
// DATABASE_URL-ийг .env-ээс уншина. src/lib/customer-number.js-тэй ижил дүрмээр үүсгэнэ.
import "dotenv/config";
import { randomInt } from "node:crypto";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 10;

const randomCode = () => Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const isMixed = (code) => /[A-Z]/.test(code) && /\d/.test(code);

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

async function uniqueCustomerNumber() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    if (!isMixed(code)) continue;
    const taken = await prisma.organization.findUnique({ where: { customerNumber: code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error("Давхардаагүй харилцагчийн дугаар үүсгэж чадсангүй");
}

try {
  const organizations = await prisma.organization.findMany({
    where: { customerNumber: null },
    select: { id: true, name: true },
  });
  for (const organization of organizations) {
    const customerNumber = await uniqueCustomerNumber();
    await prisma.organization.update({ where: { id: organization.id }, data: { customerNumber } });
    console.log(`${organization.name} → ${customerNumber}`);
  }
  console.log(`${organizations.length} байгууллагад дугаар үүсгэлээ`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
