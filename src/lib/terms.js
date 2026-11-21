import { prisma } from "@/lib/prisma";
import { readDocument } from "@/lib/content";

// Үйлчилгээний нөхцөлийг нэвтэрсэн байгууллагын хэрэглэгчид харуулах дүрэм:
//  - байгууллага багц худалдан аваагүй (зөвхөн үнэгүй туршилтын багц) бол нөхцлийг нэвтрэх бүрт
//    зөвхөн уншуулахаар харуулна (зөвшөөрөх боломжгүй);
//  - багц худалдан авсны дараа зөвшөөрөх сонголттой харуулна;
//  - одоогийн хувилбарыг зөвшөөрсөн хэрэглэгчид харуулахгүй. terms.md-ийн version өөрчлөгдвөл дахин.

// Байгууллага туршилтын бус (гэрээ шаардах эсвэл төлбөртэй) багц идэвхжүүлж байсан эсэх
export async function hasPurchasedPackage(organizationId) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      organizationId,
      startsAt: { not: null },
      OR: [{ basePrice: { gt: 0 } }, { package: { contractRequired: true } }],
    },
    select: { id: true },
  });
  return Boolean(subscription);
}

// Зөвшөөрөх хувилбар: үйлчилгээний нөхцөл болон нууцлалын бодлогын хувилбар. Аль нэг нь
// шинэчлэгдвэл (md файлын "<!-- version: ... -->") хэрэглэгчээс дахин зөвшөөрөл авна.
export async function agreementVersion() {
  const [terms, privacy] = await Promise.all([readDocument("terms"), readDocument("privacy")]);
  return `${terms.version}+${privacy.version}`;
}

// Буцаах: null (харуулахгүй) эсвэл { mode: "view" | "accept", version, markdown }
export async function termsPrompt(user) {
  if (user.role === "ADMIN" || !user.organizationId) return null;
  const [{ markdown }, version, record] = await Promise.all([
    readDocument("terms"),
    agreementVersion(),
    prisma.user.findUnique({ where: { id: user.id }, select: { termsVersion: true } }),
  ]);
  if (record?.termsVersion && record.termsVersion === version) return null;
  const mode = (await hasPurchasedPackage(user.organizationId)) ? "accept" : "view";
  return { mode, version, markdown };
}
