import { prisma } from "@/lib/prisma";
import { ulaanbaatarYear } from "@/lib/format";
import { signValue, verifyValueSignature } from "@/lib/tokens";

const PURPOSE = "screening-print";

// Хэвлэсэн хуудсан дээрх QR-ын хаяг: гар утсаар уншуулахад системд баримтын үнэн зөвийг харуулна
export const printVerifyUrl = (printId) =>
  `${process.env.AUTH_URL}/verify/${printId}?s=${signValue(PURPOSE, printId)}`;


// Оны дараагийн дэс дугаар. Нэг SQL-ээр (upsert + нэмэх) хийгдэх тул зэрэг хэвлэхэд давхцахгүй.
// Transaction (tx) дотор дуудна: хэвлэлт үүсээгүй бол дугаар ч буцаж, завсар үүсэхгүй.
async function nextDocumentNumber(tx) {
  // Улаанбаатарын цагаар он: шинэ он 00:00-д дугаар 1-ээс эхэлнэ
  const year = ulaanbaatarYear();
  const [{ last }] = await tx.$queryRaw`
    INSERT INTO "DocumentCounter" ("year", "last") VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "last" = "DocumentCounter"."last" + 1
    RETURNING "last"`;
  return { year, sequence: last, documentNumber: `${year}-${last}` };
}

// Хэвлэлтийг баримтын дугаартай нь бүртгэнэ. data: { screeningId, matchIndex, userId, organizationId }
export const createPrint = (data, include) =>
  prisma.$transaction(async (tx) => tx.screeningPrint.create({ data: { ...data, ...(await nextDocumentNumber(tx)) }, include }));

// Хуучин (дугааргүй) хэвлэлтэд id-г харуулна
export const documentNumber = (print) => print.documentNumber ?? print.id;

export const isValidPrintSignature = (printId, signature) => verifyValueSignature(PURPOSE, printId, signature);

// Хэвлэлтийг бүх мэдээлэлтэй нь уншина (хэвлэх ба баталгаажуулах хуудсанд)
export function loadPrint(where) {
  return prisma.screeningPrint.findFirst({
    where,
    include: {
      user: { select: { firstName: true, lastName: true, email: true, contact: true } },
      organization: { select: { id: true, name: true, logo: true, updatedAt: true } },
      screening: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true, contact: true } },
          organization: { select: { id: true, name: true, logo: true, updatedAt: true } },
        },
      },
    },
  });
}

// Хэвлэлтийн тохирол (Screening.results доторх)
export const printMatch = (print) => print.screening.results?.[print.matchIndex] ?? null;
