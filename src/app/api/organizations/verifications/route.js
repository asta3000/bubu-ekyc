import { prisma } from "@/lib/prisma";
import { UsageError, attachUsage, consumeService, refundUsage, usageErrorResponse } from "@/lib/billing/usage";
import { DiditError, downloadImage, matchFaces, verifyDocument } from "@/lib/didit";
import { requireOrganizationApi } from "@/lib/organization-access";
import { FACE_MATCH_THRESHOLD, buildVerification } from "@/lib/verifications";
import {
  DOCUMENT_MAX_SIZE,
  DOCUMENT_TYPES,
  SELFIE_MAX_SIZE,
  SELFIE_TYPES,
  verificationFileError,
} from "@/lib/validations";

// Didit-ийн хоёр дуудлага (OCR + нүүр тулгалт) 10-30 секунд үргэлжилж болно
export const maxDuration = 60;

const fileField = (formData, name) => {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
};

const diditErrorResponse = (error) =>
  Response.json({ error: error.message }, { status: error.status >= 500 ? 502 : 400 });

// Баримтын нүүрний зураг. Олдохгүй бол баримтын нүүр талыг өөрийг нь (PDF биш бол) ашиглана.
async function referenceImage(idv, front) {
  if (idv.portrait_image) {
    try {
      return await downloadImage(idv.portrait_image);
    } catch {
      // Нүүр талын зургаар үргэлжлүүлнэ
    }
  }
  return front.type === "application/pdf" ? null : front;
}

// Баримт бичиг (нүүр, ар тал) ба сельфиг Didit-ээр шалгаж, үр дүнг хадгална
export async function POST(request) {
  const { error, session, organization } = await requireOrganizationApi();
  if (error) return error;

  const formData = await request.formData().catch(() => null);
  if (!formData) return Response.json({ error: "Хүсэлт буруу байна" }, { status: 400 });

  const front = fileField(formData, "front");
  const back = fileField(formData, "back");
  const selfie = fileField(formData, "selfie");
  const errors = {};
  // Файл байхгүй бол missing мессеж (заавал талбарт), байвал төрөл, хэмжээг шалгана
  const check = (field, file, rules, missing) => {
    const message = file ? verificationFileError(file, rules) : missing;
    if (message) errors[field] = message;
  };
  const documentRules = { types: DOCUMENT_TYPES, maxSize: DOCUMENT_MAX_SIZE };
  check("front", front, { ...documentRules, label: "Нүүр тал" }, "Баримт бичгийн нүүр талын зураг оруулна уу");
  check("back", back, { ...documentRules, label: "Ар тал" });
  check("selfie", selfie, { types: SELFIE_TYPES, maxSize: SELFIE_MAX_SIZE, label: "Сельфи" }, "Сельфи зураг оруулна уу");
  if (Object.keys(errors).length) return Response.json({ errors }, { status: 400 });

  // Didit Business Console дээр session-уудыг байгууллагаар шүүхэд
  const vendorData = `org:${organization?.id ?? "-"}:user:${session.user.id}`;

  // Багцын тоо (эсвэл задгай үнээр хэтэвч)-оос нэг удаа хасна
  let usage;
  try {
    usage = await consumeService({
      organizationId: organization?.id,
      service: "DOCUMENT_VERIFICATION",
      userId: session.user.id,
      payOverage: formData.get("payOverage") === "true",
    });
  } catch (err) {
    if (err instanceof UsageError) return usageErrorResponse(err);
    throw err;
  }

  let document;
  try {
    document = await verifyDocument({ front, back, vendorData });
  } catch (err) {
    // Баримт шалгагдаагүй тул ашиглалтыг буцаана
    await refundUsage(usage);
    if (err instanceof DiditError) return diditErrorResponse(err);
    throw err;
  }

  // Баримт шалгагдсан (төлбөр хийгдсэн) тул нүүр тулгалт амжилтгүй болсон ч үр дүнг хадгална
  let faceMatch;
  const reference = await referenceImage(document.id_verification ?? {}, front);
  if (!reference) {
    faceMatch = { error: "Баримт бичгээс нүүрний зураг олдсонгүй" };
  } else {
    try {
      faceMatch = await matchFaces({ selfie, reference, threshold: FACE_MATCH_THRESHOLD, vendorData });
    } catch (err) {
      if (!(err instanceof DiditError)) throw err;
      faceMatch = { error: err.message };
    }
  }

  const verification = await prisma.identityVerification.create({
    data: {
      ...buildVerification({ document, faceMatch }),
      userId: session.user.id,
      organizationId: organization?.id ?? null,
    },
    select: { id: true },
  });
  await attachUsage(usage, verification.id);
  return Response.json({ id: verification.id }, { status: 201 });
}
