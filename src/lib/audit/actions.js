// Аудит логийн үйлдлүүдийн бүртгэл. Шинэ үйлчилгээ нэмэхдээ энд нэг мөр нэмээд
// logAudit({ action: "<key>", ... }) дуудахад хангалттай (схем өөрчлөхгүй).
//   label: хүнд харагдах нэр
//   org:   true бол байгууллагын админ (ORG_ADMIN) өөрийн байгууллагынхыг харна.
//          Бүртгээгүй эсвэл false бол зөвхөн системийн админд харагдана.
// Client, сервер хоёуланд ашиглана.

export const AUDIT_CATEGORIES = {
  auth: "Нэвтрэлт",
  organization: "Байгууллага",
  user: "Хэрэглэгч",
  profile: "Профайл",
  screening: "Хориг тулгалт",
  verification: "Баталгаажуулалт",
  list: "Өөрийн жагсаалт",
  billing: "Багц, төлбөр",
  payment: "Төлбөрийн хяналт",
  package: "Багцын тохиргоо",
  addon: "Нэмэлт жагсаалт",
  coupon: "Купон",
  operation: "Үйл ажиллагаа",
  bank_account: "Банкны данс",
  sanctions: "Хоригийн жагсаалт",
  settings: "Тохиргоо",
};

export const AUDIT_ACTIONS = {
  "auth.register": { label: "Бүртгүүлсэн", org: true },
  "auth.login": { label: "Нэвтэрсэн", org: true },
  "auth.login_failed": { label: "Нэвтрэлт амжилтгүй", org: true },
  "auth.logout": { label: "Гарсан", org: true },
  "auth.otp_verified": { label: "OTP баталгаажсан" },
  "auth.otp_failed": { label: "OTP буруу" },
  "auth.password_reset_requested": { label: "Нууц үг сэргээх хүсэлт", org: true },
  "auth.password_reset": { label: "Нууц үг сэргээсэн", org: true },
  "auth.password_reset_failed": { label: "Нууц үг сэргээх амжилтгүй" },
  "auth.password_changed": { label: "Нууц үг сольсон", org: true },
  "auth.password_change_failed": { label: "Нууц үг солих амжилтгүй", org: true },

  "organization.register": { label: "Байгууллага бүртгүүлсэн", org: true },
  "organization.create": { label: "Байгууллага үүсгэсэн" },
  "organization.update": { label: "Байгууллагын мэдээлэл өөрчилсөн", org: true },
  "organization.delete": { label: "Байгууллага устгасан" },
  "organization.promo_create": { label: "Промо код үүсгэсэн", org: true },

  "user.join": { label: "Байгууллагад нэгдсэн", org: true },
  "user.update": { label: "Хэрэглэгчийн мэдээлэл өөрчилсөн", org: true },
  "user.password_set": { label: "Хэрэглэгчийн нууц үг сольсон", org: true },
  "profile.update": { label: "Профайлаа өөрчилсөн", org: true },

  "screening.create": { label: "Хориг тулгасан", org: true },
  "screening.batch": { label: "Файлаар олноор тулгасан", org: true },
  "screening.print": { label: "Тулгалтын баримт хэвлэсэн", org: true },
  "verification.create": { label: "Баримт баталгаажуулсан", org: true },
  "verification.registry": { label: "Улсын бүртгэлээс шалгасан", org: true },

  "list.create": { label: "Өөрийн жагсаалт үүсгэсэн", org: true },
  "list.update": { label: "Өөрийн жагсаалт өөрчилсөн", org: true },
  "list.delete": { label: "Өөрийн жагсаалт устгасан", org: true },
  "list.entry_create": { label: "Жагсаалтад бичлэг нэмсэн", org: true },
  "list.entry_update": { label: "Жагсаалтын бичлэг өөрчилсөн", org: true },
  "list.entry_delete": { label: "Жагсаалтын бичлэг устгасан", org: true },

  "billing.purchase": { label: "Багц авсан", org: true },
  "billing.renew_auto": { label: "Багц автоматаар сунгагдсан", org: true },
  "billing.topup": { label: "Хэтэвч цэнэглэх хүсэлт", org: true },
  "billing.payment_cancel": { label: "Төлбөр цуцалсан", org: true },
  "billing.addon_purchase": { label: "Нэмэлт жагсаалт авсан", org: true },
  "billing.document_email": { label: "Төлбөрийн баримт имэйлээр илгээсэн", org: true },
  "billing.addon_renew_auto": { label: "Нэмэлт жагсаалт автоматаар сунгагдсан", org: true },
  "billing.addon_auto_renew": { label: "Нэмэлт жагсаалтын автомат сунгалт өөрчилсөн", org: true },
  "payment.confirm": { label: "Төлбөр баталгаажуулсан", org: true },
  "payment.reject": { label: "Төлбөр татгалзсан", org: true },
  "payment.check": { label: "Төлбөр шалгасан" },

  "package.create": { label: "Багц үүсгэсэн" },
  "package.update": { label: "Багц өөрчилсөн" },
  "package.delete": { label: "Багц устгасан" },
  "addon.update": { label: "Нэмэлт жагсаалтын үнэ өөрчилсөн" },
  "coupon.create": { label: "Купон үүсгэсэн" },
  "coupon.update": { label: "Купон өөрчилсөн" },
  "coupon.delete": { label: "Купон устгасан" },
  "operation.create": { label: "Үйл ажиллагаа үүсгэсэн" },
  "operation.update": { label: "Үйл ажиллагаа өөрчилсөн" },
  "operation.delete": { label: "Үйл ажиллагаа устгасан" },
  "bank_account.create": { label: "Банкны данс нэмсэн" },
  "bank_account.update": { label: "Банкны данс өөрчилсөн" },
  "bank_account.delete": { label: "Банкны данс устгасан" },
  "sanctions.import": { label: "Хоригийн жагсаалт импортолсон" },
  "settings.system": { label: "Системийн мэдээлэл өөрчилсөн" },
  "settings.matching": { label: "Тулгалтын оноо өөрчилсөн" },
  "settings.matching_reset": { label: "Тулгалтын оноог анхны утгад буцаасан" },
  "settings.referral": { label: "Санал болголтын хувь өөрчилсөн" },
  "settings.registration": { label: "Бүртгэлийн тохиргоо өөрчилсөн" },
};

export const auditCategory = (action) => action.split(".")[0];

export const auditActionLabel = (action) => AUDIT_ACTIONS[action]?.label ?? action;

export const auditCategoryLabel = (category) => AUDIT_CATEGORIES[category] ?? category;

// Байгууллагын админд харагдах үйлдлүүд
export const ORG_VISIBLE_ACTIONS = Object.keys(AUDIT_ACTIONS).filter((key) => AUDIT_ACTIONS[key].org);
