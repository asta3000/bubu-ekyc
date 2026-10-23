// Төлөв, түвшин харуулах жижиг тэмдэг. tone: gray | green | red | amber | blue.
// solid бол бараан дэвсгэртэй (эрсдэлийн оноо г.м. анхаарал татах үед).
const SOFT = {
  gray: "bg-gray-100 text-gray-600",
  green: "bg-green-50 text-green-700",
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700",
};

const SOLID = {
  gray: "bg-gray-200 text-gray-700",
  green: "bg-green-600 text-white",
  red: "bg-red-600 text-white",
  amber: "bg-amber-500 text-white",
  blue: "bg-blue-600 text-white",
};

export const toneClass = (tone = "gray", solid = false) => (solid ? SOLID : SOFT)[tone] ?? SOFT.gray;

export const Badge = ({ tone, solid = false, className = "", ...props }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneClass(tone, solid)} ${className}`} {...props} />
);

// statuses: { KEY: { label, tone } }. Тодорхойгүй төлөвийг саарал, fallback текстээр.
export const StatusBadge = ({ status, statuses, fallback = "—" }) => {
  const item = statuses[status];
  return <Badge tone={item?.tone}>{item?.label ?? status ?? fallback}</Badge>;
};
