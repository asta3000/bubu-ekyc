export const SUBJECT_LABELS = {
  INDIVIDUAL: "Хувь хүн",
  ENTITY: "Хуулийн этгээд",
  VESSEL: "Хөлөг онгоц",
  AIRCRAFT: "Нисэх онгоц",
};

// Шалгуур тус бүрийн тулгалтын үр дүн. Таарсан нь эрсдэл (улаан), зөрсөн нь
// хуурамч тохирол байх магадлал (ногоон).
export const CHECK_LABELS = {
  exact: { label: "Огноо таарсан", tone: "red" },
  year: { label: "Он таарсан", tone: "red" },
  match: { label: "Таарсан", tone: "red" },
  mismatch: { label: "Зөрсөн", tone: "green" },
  nomatch: { label: "Таараагүй", tone: "gray" },
  unknown: { label: "Мэдээлэлгүй", tone: "gray" },
};

// Оноогоор эрсдэлийн түвшин
export const scoreLevel = (score) =>
  score >= 95
    ? { label: "Өндөр", tone: "red" }
    : score >= 85
      ? { label: "Дунд", tone: "amber" }
      : { label: "Бага", tone: "gray" };
