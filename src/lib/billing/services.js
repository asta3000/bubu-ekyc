// Багцаар тооцоологдох үйлчилгээнүүд. Шинэ үйлчилгээ нэмэхдээ энд бүртгээд,
// тухайн үйлчилгээний API-д consumeService(..., "<key>") дуудна. Client-д ч ашиглана.
export const BILLABLE_SERVICES = [
  {
    key: "SANCTION_SCREENING",
    name: "Хориг шалгах",
    unit: "шалгалт",
    href: "/organizations/match",
  },
  {
    key: "DOCUMENT_VERIFICATION",
    name: "Баримт бичиг баталгаажуулах",
    unit: "баталгаажуулалт",
    href: "/organizations/verifications",
  },
];

export const SERVICE_KEYS = BILLABLE_SERVICES.map((service) => service.key);

export const billableService = (key) => BILLABLE_SERVICES.find((service) => service.key === key);

export const serviceName = (key) => billableService(key)?.name ?? key;

// Үйлчилгээнд багцын тоо хэрэглэгдэх эсэх: суурь үнэтэй багц, эсвэл тоо оруулсан үйлчилгээ.
// Суурь үнэ 0, тоо 0 бол бүх ашиглалт шууд задгай үнээр хэтэвчнээс.
export const includesQuota = (basePrice, quota) => basePrice > 0 || quota > 0;
