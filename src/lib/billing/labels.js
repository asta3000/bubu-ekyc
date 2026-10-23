// Төлбөрийн төлөв, арга зэргийн шошго (админ ба байгууллагын хуудсанд)
export const PAYMENT_STATUSES = {
  PENDING: { label: "Хүлээгдэж буй", tone: "amber" },
  PAID: { label: "Төлөгдсөн", tone: "green" },
  REJECTED: { label: "Татгалзсан", tone: "red" },
  CANCELLED: { label: "Цуцалсан", tone: "gray" },
};

export const PAYMENT_METHODS = { QPAY: "QPay", BANK_TRANSFER: "Банкны шилжүүлэг", WALLET: "Хэтэвч" };

export const PAYMENT_PURPOSES = { WALLET_TOPUP: "Хэтэвч цэнэглэх", PACKAGE_PURCHASE: "Багц" };

export const SUBSCRIPTION_STATUSES = {
  PENDING: { label: "Төлбөр хүлээгдэж буй", tone: "amber" },
  ACTIVE: { label: "Идэвхтэй", tone: "green" },
  ENDED: { label: "Дууссан", tone: "gray" },
  CANCELLED: { label: "Цуцалсан", tone: "gray" },
};

export const WALLET_TRANSACTION_TYPES = {
  TOPUP: "Цэнэглэлт",
  PACKAGE_PURCHASE: "Багц худалдан авалт",
  USAGE: "Үйлчилгээний төлбөр",
  REFUND: "Буцаалт",
  ADJUSTMENT: "Залруулга",
  REFERRAL_BONUS: "Санал болголтын урамшуулал",
};

export const COUPON_TYPES = {
  PERCENT: "Хувиар хямдруулах (%)",
  AMOUNT: "Дүнгээр хямдруулах (₮)",
  EXTEND_DAYS: "Хугацаа сунгах (хоног)",
};

// Купоны давуу тал: "15%", "5,000₮", "+30 хоног"
export const couponBenefit = ({ discountType, discountValue }) =>
  discountType === "PERCENT"
    ? `${discountValue}%`
    : discountType === "AMOUNT"
      ? `${discountValue.toLocaleString("en-US")}₮`
      : `+${discountValue} хоног`;

// Төлбөрийн зориулалт: "Багц: Basic" г.м.
// payment.redemption өгвөл ашигласан купоныг нэмж харуулна
export const paymentPurpose = (payment) => {
  const purpose =
    payment.purpose === "PACKAGE_PURCHASE" && payment.subscription
      ? `Багц: ${payment.subscription.packageName}`
      : PAYMENT_PURPOSES[payment.purpose];
  return payment.redemption ? `${purpose} · купон ${payment.redemption.coupon.code}` : purpose;
};
