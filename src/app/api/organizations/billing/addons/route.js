import { parseBody } from "@/lib/api";
import { requireBillingApi } from "@/lib/billing/access";
import { AddonError, purchaseAddon, setAddonAutoRenew } from "@/lib/billing/addons";
import { InsufficientFundsError } from "@/lib/billing/wallet";
import { formatDate, formatMoney } from "@/lib/format";
import { sanctionSource } from "@/lib/sanctions/sources";
import { addonAutoRenewSchema, addonPurchaseSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit/log";

// Улсын нэмэлт жагсаалтыг хэтэвчнээс худалдаж авна (идэвхтэй бол сунгана)
export async function POST(request) {
  const { error, session, organization } = await requireBillingApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, addonPurchaseSchema);
  if (invalid) return invalid;

  try {
    const addon = await purchaseAddon({ organizationId: organization.id, userId: session.user.id, source: data.source });
    const name = sanctionSource(addon.source).name;
    await logAudit({
      action: "billing.addon_purchase",
      actor: session.user,
      organizationId: organization.id,
      entity: { type: "OrganizationAddon", id: addon.id },
      summary: `${name} нэмэлт жагсаалтыг ${formatMoney(addon.price)}-өөр ${formatDate(addon.expiresAt)} хүртэл авав`,
      metadata: { source: addon.source, price: addon.price, startsAt: addon.startsAt, expiresAt: addon.expiresAt },
    });
    return Response.json(
      { message: `${name} ${formatDate(addon.expiresAt)} хүртэл идэвхжлээ` },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return Response.json({ error: "Хэтэвчний үлдэгдэл хүрэлцэхгүй байна. Хэтэвчээ цэнэглэнэ үү." }, { status: 402 });
    }
    if (err instanceof AddonError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

// Нэмэлт жагсаалтын автомат сунгалтыг зогсоох / сэргээх. Зогсоосон ч хугацаа дуустал ашиглана.
export async function PATCH(request) {
  const { error, session, organization } = await requireBillingApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, addonAutoRenewSchema);
  if (invalid) return invalid;

  try {
    const addon = await setAddonAutoRenew({ organizationId: organization.id, ...data });
    const name = sanctionSource(addon.source).name;
    await logAudit({
      action: "billing.addon_auto_renew",
      actor: session.user,
      organizationId: organization.id,
      entity: { type: "OrganizationAddon", id: addon.id },
      summary: `${name} нэмэлт жагсаалтын автомат сунгалтыг ${data.autoRenew ? "сэргээв" : "зогсоов"}`,
      metadata: { source: addon.source, autoRenew: data.autoRenew },
    });
    return Response.json({
      message: data.autoRenew
        ? `${name}-ийн автомат сунгалт сэргээгдлээ`
        : `${name}-ийн автомат сунгалт зогслоо. ${formatDate(addon.expiresAt)} хүртэл ашиглах боломжтой.`,
    });
  } catch (err) {
    if (err instanceof AddonError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
