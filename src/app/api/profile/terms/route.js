import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/api";
import { requireSessionApi } from "@/lib/session";
import { agreementVersion, hasPurchasedPackage } from "@/lib/terms";
import { logAudit } from "@/lib/audit/log";

const schema = z.object({ version: z.string({ error: "Хувилбар буруу байна" }).min(1) });

// Үйлчилгээний нөхцөлийг зөвшөөрөх. Зөвхөн одоогийн хувилбарыг, багц худалдан авсан
// байгууллагын хэрэглэгч зөвшөөрнө (src/lib/terms.js-ийн дүрэм).
export async function POST(request) {
  const { error, session } = await requireSessionApi();
  if (error) return error;
  const { organizationId } = session.user;
  if (!organizationId) return Response.json({ error: "Таны бүртгэл байгууллагад холбогдоогүй байна" }, { status: 403 });

  const { data, error: invalid } = await parseBody(request, schema);
  if (invalid) return invalid;

  const current = await agreementVersion();
  if (data.version !== current) {
    return Response.json({ error: "Үйлчилгээний нөхцөл шинэчлэгдсэн байна. Хуудсыг дахин ачаалж уншина уу." }, { status: 409 });
  }
  if (!(await hasPurchasedPackage(organizationId))) {
    return Response.json({ error: "Багц худалдан авсны дараа нөхцлийг зөвшөөрнө" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { termsVersion: current, termsAcceptedAt: new Date() },
  });
  await logAudit({
    action: "profile.terms_accept",
    actor: session.user,
    organizationId,
    entity: { type: "User", id: session.user.id },
    summary: `Үйлчилгээний нөхцөл, нууцлалын бодлогын ${current} хувилбарыг зөвшөөрөв`,
    metadata: { version: current },
  });
  return Response.json({ message: "Үйлчилгээний нөхцлийг зөвшөөрлөө" });
}
