import { prisma } from "@/lib/prisma";

// Банкны шилжүүлгийн үед харуулах дансны дээд тоо
export const MAX_BANK_ACCOUNTS = 2;

// Идэвхтэй данснууд (байгууллагад бүгдийг зэрэг харуулна)
export const activeBankAccounts = () =>
  prisma.bankAccount.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, bankName: true, accountName: true, accountNumber: true, iban: true },
  });
