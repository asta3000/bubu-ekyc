import { renewAllDue } from "@/lib/billing/renewals";

export const maxDuration = 300;

// Vercel Cron (vercel.json) өдөр бүр дуудна: хугацаа нь дууссан багц, автомат сунгалттай
// нэмэлт жагсаалтуудыг хэтэвчний үлдэгдлээр сунгана. Байгууллага үйлчилгээ ашиглах, багцын хуудсаа нээх үед ч шалгагддаг.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Хандах эрхгүй" }, { status: 401 });
  }
  return Response.json(await renewAllDue());
}
