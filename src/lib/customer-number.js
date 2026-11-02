import { prisma } from "@/lib/prisma";
import { randomCode } from "@/lib/codes";

export const CUSTOMER_NUMBER_LENGTH = 10;
const MAX_ATTEMPTS = 10;

// Латин үсэг, тоо хоёулаа орсон эсэх
const isMixed = (code) => /[A-Z]/.test(code) && /\d/.test(code);

// Байгууллагын давхардаагүй харилцагчийн дугаар (жишээ: K7M2Q9X4BT)
export async function uniqueCustomerNumber() {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = randomCode(CUSTOMER_NUMBER_LENGTH);
    if (!isMixed(code)) continue;
    const taken = await prisma.organization.findUnique({ where: { customerNumber: code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error("Давхардаагүй харилцагчийн дугаар үүсгэж чадсангүй");
}
