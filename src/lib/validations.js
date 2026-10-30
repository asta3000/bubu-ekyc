import { z } from "zod";
import { SERVICE_KEYS } from "@/lib/billing/services";
import { SANCTION_SOURCE_KEYS } from "@/lib/sanctions/sources";
import { MATCHING_FIELDS } from "@/lib/screening/config";

export const emailSchema = z
  .string({ error: "И-мэйл хаяг оруулна уу" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "И-мэйл хаяг буруу байна" }));

// bcrypt нь эхний 72 байтыг л ашигладаг
const password = z
  .string({ error: "Нууц үг оруулна уу" })
  .min(8, { error: "Нууц үг хамгийн багадаа 8 тэмдэгт байна" })
  .max(72, { error: "Нууц үг хамгийн ихдээ 72 тэмдэгт байна" });

const name = (label) =>
  z
    .string({ error: `${label} оруулна уу` })
    .trim()
    .min(1, { error: `${label} оруулна уу` })
    .max(50, { error: `${label} хэт урт байна` });

const email = emailSchema;

const contact = z
  .string({ error: "Холбоо барих мэдээлэл оруулна уу" })
  .trim()
  .min(1, { error: "Холбоо барих мэдээлэл оруулна уу" })
  .max(100, { error: "Холбоо барих мэдээлэл хэт урт байна" });

export const otpSchema = z
  .string({ error: "Код оруулна уу" })
  .trim()
  .regex(/^\d{6}$/, { error: "6 оронтой код оруулна уу" });

export const emailOnlySchema = z.object({ email });

export const verifyOtpSchema = z.object({ email, code: otpSchema });

export const loginSchema = z.object({
  email,
  password: z.string({ error: "Нууц үг оруулна уу" }).min(1, { error: "Нууц үг оруулна уу" }),
});

// Бүртгүүлсэн хэрэглэгч ORGANIZATION эрхтэй болно (schema-ийн анхны утга)
export const registerSchema = z.object({
  verificationToken: z.string({ error: "И-мэйлээ баталгаажуулна уу" }),
  firstName: name("Нэр"),
  lastName: name("Овог"),
  contact,
  password,
});

export const forgotPasswordSchema = emailOnlySchema;

// Нууц үг ба давталт таарахгүй бол формын алдаа, таарвал null
export const passwordMismatch = ({ password, confirmPassword }) =>
  password === confirmPassword ? null : { confirmPassword: "Нууц үг таарахгүй байна" };

export const resetPasswordSchema = z.object({
  token: z.string({ error: "Token олдсонгүй" }).min(1, { error: "Token олдсонгүй" }),
  password,
});

// Zod-ийн алдааг { field: "мессеж" } хэлбэрт оруулна
export function fieldErrors(error) {
  const errors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] ?? "form";
    errors[key] ??= issue.message;
  }
  return errors;
}

// ---- Удирдлага (/managements) ----

// Хоосон утгыг ("Сонгоогүй" select, хоосон input) null болгоно
const nullable = (schema) =>
  z.preprocess((value) => (value === "" || value === undefined ? null : value), schema.nullable());

const title = (label) =>
  z
    .string({ error: `${label} оруулна уу` })
    .trim()
    .min(1, { error: `${label} оруулна уу` })
    .max(100, { error: `${label} хэт урт байна` });

// DELETED төлөвийг зөвхөн DELETE хүсэлтээр тогтооно
const status = z.enum(["ACTIVE", "INACTIVE"], { error: "Төлөв буруу байна" });

export const operationSchema = z.object({
  name: title("Нэр"),
  status,
});

// Лого нь файл тул multipart form-оос тусад нь шалгана (logoFileError)
export const organizationSchema = z.object({
  name: title("Нэр"),
  operationId: nullable(z.string()),
  status,
});

// Санал болголтын урамшууллын хувь (байгууллагын промо кодын Promo.discount). Анхдагч 2.
export const DEFAULT_REFERRAL_RATE = 2;
export const referralRateSchema = z.coerce
  .number({ error: "Хувь оруулна уу" })
  .int({ error: "Бүхэл тоо оруулна уу" })
  .min(0, { error: "Хувь 0-50 хооронд байна" })
  .max(50, { error: "Хувь 0-50 хооронд байна" });

// Байгууллагын лого. SVG-д script агуулагдаж болох тул зөвхөн растер зураг.
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const LOGO_MAX_SIZE = 1024 * 1024;

// Алдаатай бол мессеж, зөв бол null. Client, сервер хоёуланд ашиглана.
export function logoFileError(file) {
  if (!LOGO_TYPES.includes(file.type)) return "Зөвхөн PNG, JPG, WEBP зураг оруулна уу";
  if (file.size > LOGO_MAX_SIZE) return "Зургийн хэмжээ 1MB-аас ихгүй байна";
  return null;
}

export const manageUserSchema = z.object({
  organizationId: nullable(z.string()),
  role: z.enum(["ADMIN", "ORGANIZATION"], { error: "Эрх буруу байна" }),
  status,
});

// ---- Профайл (/profile) ----

export const profileSchema = z.object({
  firstName: name("Нэр"),
  lastName: name("Овог"),
  contact,
});

// Нууц үггүй (Google-ээр бүртгүүлсэн) хэрэглэгч одоогийн нууц үггүйгээр тохируулна
export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  password,
});

// ---- Хоригийн жагсаалт ----

export const sanctionImportSchema = z.object({
  source: z.enum(SANCTION_SOURCE_KEYS, {
    error: "Эх сурвалж буруу байна",
  }),
});

// ---- Хоригийн жагсаалттай тулгах (/organizations/match) ----

export const matchSchema = z.object({
  name: z
    .string({ error: "Нэр оруулна уу" })
    .trim()
    .min(2, { error: "Нэр оруулна уу" })
    .max(200, { error: "Нэр хэт урт байна" }),
  subjectType: nullable(z.enum(["INDIVIDUAL", "ENTITY", "VESSEL", "AIRCRAFT"], { error: "Төрөл буруу байна" })),
  // "1975" эсвэл "1975-03-21"
  birthDate: nullable(
    z
      .string()
      .trim()
      .regex(/^\d{4}(-\d{2}-\d{2})?$/, { error: "Он (1975) эсвэл огноо (1975-03-21) оруулна уу" }),
  ),
  country: nullable(z.string().trim().regex(/^[A-Z]{2}$/, { error: "Улс буруу байна" })),
  identifier: nullable(z.string().trim().max(100, { error: "Дугаар хэт урт байна" })),
  sources: z
    .array(z.enum(SANCTION_SOURCE_KEYS), { error: "Жагсаалт сонгоно уу" })
    .min(1, { error: "Дор хаяж нэг жагсаалт сонгоно уу" }),
  threshold: z.coerce
    .number({ error: "Босго буруу байна" })
    .int()
    .min(60, { error: "Босго 60-100 хооронд байна" })
    .max(100, { error: "Босго 60-100 хооронд байна" }),
  // Багцын тоо дууссан үед задгай үнээр төлөхийг хэрэглэгч баталгаажуулсан
  payOverage: z.boolean().optional().default(false),
});

// ---- Иргэний бичиг баримт, нүүр тулгалт (Didit) ----

// Didit-ийн хязгаар: баримт 10MB (PDF зөвшөөрнө), нүүрний зураг 5MB
export const DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const SELFIE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const DOCUMENT_MAX_SIZE = 10 * 1024 * 1024;
export const SELFIE_MAX_SIZE = 5 * 1024 * 1024;

// Алдаатай бол мессеж, зөв бол null
export function verificationFileError(file, { types, maxSize, label }) {
  if (!types.includes(file.type)) {
    return `${label}: ${types.includes("application/pdf") ? "JPG, PNG, WEBP эсвэл PDF" : "JPG, PNG эсвэл WEBP"} файл оруулна уу`;
  }
  if (file.size > maxSize) return `${label}: файлын хэмжээ ${maxSize / 1024 / 1024}MB-аас ихгүй байна`;
  return null;
}

// ---- ХУР (регистрийн дугаар, иргэний үнэмлэх) ----

export const registryCheckSchema = z.object({
  regnum: z
    .string({ error: "Регистрийн дугаар оруулна уу" })
    .trim()
    .toUpperCase()
    .regex(/^[А-ЯЁӨҮ]{2}\d{8}$/, { error: "Регистрийн дугаар 2 кирилл үсэг, 8 тоо байна (УБ90010112)" }),
  civilId: nullable(z.string().trim().regex(/^\d{1,20}$/, { error: "Иргэний хувийн дугаар тоо байна" })),
});

// ---- Купон ----

// <input type="date">-ийн "yyyy-mm-dd"-г Улаанбаатарын цагаар өдрийн эхлэл/төгсгөл болгоно
const dayStart = (value) => new Date(`${value}T00:00:00+08:00`);
const dayEnd = (value) => new Date(`${value}T23:59:59.999+08:00`);
const dateField = nullable(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Огноо буруу байна" }));

export const couponSchema = z
  .object({
    // Хоосон бол сервер автоматаар үүсгэнэ
    code: nullable(
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9-]{4,32}$/, { error: "Код 4-32 тэмдэгт, латин том үсэг, тоо, зураас байна" }),
    ),
    description: nullable(z.string().trim().max(200, { error: "Тайлбар хэт урт байна" })),
    // PERCENT, AMOUNT: багцын үнийг хямдруулна; EXTEND_DAYS: хугацааг discountValue хоногоор сунгана
    discountType: z.enum(["PERCENT", "AMOUNT", "EXTEND_DAYS"], { error: "Купоны төрөл буруу байна" }),
    discountValue: z.coerce
      .number({ error: "Хэмжээ оруулна уу" })
      .int({ error: "Бүхэл тоо оруулна уу" })
      .min(1, { error: "Хэмжээ 0-ээс их байна" }),
    // Хоосон бол бүх байгууллага ашиглана
    organizationId: nullable(z.string()),
    usageLimit: nullable(
      z.coerce.number({ error: "Тоо оруулна уу" }).int({ error: "Бүхэл тоо оруулна уу" }).min(1, { error: "Дор хаяж 1" }),
    ),
    startsAt: dateField,
    expiresAt: dateField,
    status,
  })
  .refine((data) => data.discountType !== "PERCENT" || data.discountValue <= 100, {
    path: ["discountValue"],
    error: "Хувь 100-аас ихгүй байна",
  })
  .refine((data) => !data.startsAt || !data.expiresAt || data.startsAt <= data.expiresAt, {
    path: ["expiresAt"],
    error: "Дуусах огноо эхлэх огнооноос хойш байна",
  })
  .transform((data) => ({
    ...data,
    startsAt: data.startsAt ? dayStart(data.startsAt) : null,
    expiresAt: data.expiresAt ? dayEnd(data.expiresAt) : null,
  }));

// ---- Багц, хэтэвч, төлбөр ----

const money = (label, min = 0) =>
  z.coerce
    .number({ error: `${label} оруулна уу` })
    .int({ error: "Бүхэл тоо оруулна уу" })
    .min(min, { error: `${label} ${min}-ээс багагүй байна` })
    .max(1_000_000_000, { error: `${label} хэт их байна` });

export const packageSchema = z
  .object({
    name: title("Нэр"),
    description: nullable(z.string().trim().max(500, { error: "Тайлбар хэт урт байна" })),
    basePrice: money("Суурь үнэ"),
    durationDays: nullable(
      z.coerce.number({ error: "Хоног оруулна уу" }).int().min(1, { error: "Дор хаяж 1 хоног" }).max(3650, { error: "Хэт урт" }),
    ),
    status,
    items: z
      .array(
        z.object({
          service: z.enum(SERVICE_KEYS, { error: "Үйлчилгээ буруу байна" }),
          quota: z.coerce.number({ error: "Тоо оруулна уу" }).int().min(0, { error: "Тоо 0-ээс багагүй" }),
          unitPrice: money("Задгай үнэ"),
        }),
      )
      .min(1, { error: "Дор хаяж нэг үйлчилгээ сонгоно уу" }),
  })
  .refine((data) => new Set(data.items.map((item) => item.service)).size === data.items.length, {
    path: ["items"],
    error: "Үйлчилгээ давхардсан байна",
  });

// Доод дүнг (хамгийн хямд багцын үнэ) API нь minTopupAmount()-аар шалгана
export const topupSchema = z.object({
  amount: money("Дүн", 1),
  method: z.enum(["QPAY", "BANK_TRANSFER"], { error: "Төлбөрийн арга сонгоно уу" }),
});

const couponCode = nullable(z.string().trim().toUpperCase().max(32, { error: "Купон код буруу байна" }));

export const purchaseSchema = z.object({
  packageId: z.string({ error: "Багц сонгоно уу" }).min(1, { error: "Багц сонгоно уу" }),
  method: z.enum(["WALLET", "QPAY", "BANK_TRANSFER"], { error: "Төлбөрийн арга сонгоно уу" }),
  couponCode,
});

// Худалдан авахаас өмнө купоны үр дүнг урьдчилан харах
export const couponPreviewSchema = z.object({
  packageId: z.string({ error: "Багц сонгоно уу" }).min(1, { error: "Багц сонгоно уу" }),
  couponCode: z.string({ error: "Купон код оруулна уу" }).trim().toUpperCase().min(1, { error: "Купон код оруулна уу" }).max(32),
});

export const paymentReviewSchema = z.object({
  adminNote: nullable(z.string().trim().max(500, { error: "Тайлбар хэт урт байна" })),
  // QPay-ээс шалгаж чадахгүй үед ч хаах (админ баталгаажуулсан)
  force: z.boolean().optional().default(false),
});

export const bankAccountSchema = z.object({
  bankName: title("Банкны нэр"),
  accountName: title("Дансны нэр"),
  accountNumber: z
    .string({ error: "Дансны дугаар оруулна уу" })
    .trim()
    .regex(/^[0-9 ]{6,30}$/, { error: "Дансны дугаар буруу байна" }),
  iban: nullable(z.string().trim().toUpperCase().regex(/^[A-Z0-9 ]{10,40}$/, { error: "IBAN буруу байна" })),
  sortOrder: z.coerce.number().int().min(0).max(99).default(0),
  status,
});

// ---- Тулгалт хэвлэх ----

export const printSchema = z.object({
  index: z.coerce.number({ error: "Тохирол сонгоно уу" }).int().min(0, { error: "Тохирол буруу байна" }),
});

// ---- Системийн тохиргоо ----

const optionalText = (max, label) => nullable(z.string().trim().max(max, { error: `${label} хэт урт байна` }));

// Сошиал хуудасны хаяг: тухайн сайтын https холбоос
const socialUrl = (label, host) =>
  nullable(
    z
      .url({ protocol: /^https$/, hostname: host, error: `${label} хаяг буруу байна (https://...)` })
      .max(200, { error: "Хаяг хэт урт байна" }),
  );

export const systemSettingsSchema = z.object({
  purpose: optionalText(200, "Зориулалт"),
  website: nullable(
    z.url({ protocol: /^https?$/, error: "Вэбсайтын хаяг буруу байна (https://...)" }).max(200, { error: "Хаяг хэт урт байна" }),
  ),
  email: nullable(z.email({ error: "И-мэйл хаяг буруу байна" }).max(100)),
  phone: optionalText(50, "Утас"),
  address: optionalText(300, "Хаяг"),
  linkedin: socialUrl("LinkedIn", /^([\w-]+\.)?linkedin\.com$/),
  facebook: socialUrl("Facebook", /^([\w-]+\.)?(facebook\.com|fb\.com)$/),
  instagram: socialUrl("Instagram", /^([\w-]+\.)?instagram\.com$/),
});

// ---- Хориг тулгалтын онооны тохиргоо ----

const matchingNumber = ({ label, min, max, step }) => {
  const number = z.coerce
    .number({ error: `${label} оруулна уу` })
    .min(min, { error: `${label} ${min}-${max} хооронд байна` })
    .max(max, { error: `${label} ${min}-${max} хооронд байна` });
  return step >= 1 ? number.int({ error: `${label} бүхэл тоо байна` }) : number;
};

export const matchingSettingsSchema = z.object({
  ...Object.fromEntries(MATCHING_FIELDS.flatMap((group) => group.fields).map((field) => [field.key, matchingNumber(field)])),
  // Таслал эсвэл мөр шилжилтээр тусгаарласан үгс → давхардалгүй жижиг үсгийн жагсаалт
  stopWords: z
    .string()
    .max(3000, { error: "Хэт урт байна" })
    .transform((text) => [...new Set(text.split(/[\s,]+/).map((word) => word.trim().toLowerCase()).filter(Boolean))]),
});

// Онооны тооцоог турших: хоёр нэр, хадгалаагүй тохиргоо (заавал биш)
export const matchingTestSchema = z.object({
  query: z.string({ error: "Хайсан нэр оруулна уу" }).trim().min(1, { error: "Хайсан нэр оруулна уу" }).max(200),
  candidate: z.string({ error: "Жагсаалтын нэр оруулна уу" }).trim().min(1, { error: "Жагсаалтын нэр оруулна уу" }).max(200),
  config: matchingSettingsSchema.optional(),
});
