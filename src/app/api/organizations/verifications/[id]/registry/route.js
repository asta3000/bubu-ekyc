import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/api";
import { organizationScope, requireOrganizationApi } from "@/lib/organization-access";
import { XYP_ENABLED, XYP_OPERATIONS, XypError, checkCitizenRegnum, getCitizenIdCardInfo, isXypConfigured } from "@/lib/xyp";
import { registryCheckSchema } from "@/lib/validations";

export const maxDuration = 60;

// Баталгаажуулалтын регистрийн дугаараар ХУР-ын хоёр сервисийг дуудаж, хариуг хадгална:
// WS100125 (регистр үнэн эсэх), WS100101 (иргэний үнэмлэхний мэдээлэл)
export async function POST(request, ctx) {
  // ХУР-ын холболт хийгдээгүй тул түр унтраав (lib/xyp.js-ийн XYP_ENABLED)
  if (!XYP_ENABLED) {
    return Response.json({ error: "ХУР-ын шалгалт түр ажиллахгүй байна" }, { status: 503 });
  }

  const { error, session, organization } = await requireOrganizationApi();
  if (error) return error;

  if (!isXypConfigured()) {
    return Response.json({ error: "ХУР-ын холболт тохируулаагүй байна. Админд хандана уу." }, { status: 503 });
  }

  const { data, error: invalid } = await parseBody(request, registryCheckSchema);
  if (invalid) return invalid;

  const { id } = await ctx.params;
  const verification = await prisma.identityVerification.findFirst({
    where: { id, ...organizationScope(session, organization) },
    select: { id: true },
  });
  if (!verification) return Response.json({ error: "Баталгаажуулалт олдсонгүй" }, { status: 404 });

  // Нэг нь амжилтгүй болсон ч нөгөөгийн хариуг хадгална
  const calls = [
    [XYP_OPERATIONS.checkRegnum, () => checkCitizenRegnum(data.regnum)],
    [XYP_OPERATIONS.idCardInfo, () => getCitizenIdCardInfo(data)],
  ];
  const results = await Promise.allSettled(calls.map(([, run]) => run()));

  await prisma.registryCheck.createMany({
    data: results.map((result, index) => {
      const base = {
        verificationId: verification.id,
        userId: session.user.id,
        organizationId: organization?.id ?? null,
        operation: calls[index][0],
        regnum: data.regnum,
      };
      // Prisma-ийн Json талбарт null биш undefined (хоосон) өгнө
      if (result.status === "fulfilled") return { ...base, ...result.value, response: result.value.response ?? undefined };
      if (!(result.reason instanceof XypError)) console.error("[xyp]", result.reason);
      return { ...base, error: result.reason.message ?? "Тодорхойгүй алдаа" };
    }),
  });

  return Response.json({ ok: true });
}
