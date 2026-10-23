import { Badge } from "@/components/Badges";
import { Card } from "@/components/Cards";
import { Message } from "@/components/Messages";
import { formatDateTime, personName } from "@/lib/format";
import { normalizeRegnum } from "@/lib/regnum";
import { compareWithRegistry, registryBirthDate } from "@/lib/registry-compare";
import { XYP_ENABLED, XYP_OPERATIONS, XYP_RESULT_CODES } from "@/lib/xyp";
import RegistryForm from "./registry-form";
import { Field } from "@/components/Fields";

const MATCH_BADGES = {
  true: { label: "Таарсан", tone: "green" },
  false: { label: "Зөрсөн", tone: "red" },
  null: { label: "—", tone: "gray" },
};

// ХУР-ын хариуны төлөв: холболтын алдаа, resultCode-ийн тайлбар
function CheckError({ check }) {
  if (check.error) return <Message error={check.error} />;
  if (check.resultCode === 0) return null;
  const text = check.resultMessage ?? XYP_RESULT_CODES[check.resultCode] ?? "Тодорхойгүй хариу";
  return check.resultCode === 1 ? (
    <p className="text-sm text-gray-600">{text}</p>
  ) : (
    <Message error={`ХУР (${check.resultCode}): ${text}`} />
  );
}

const CheckMeta = ({ check }) => (
  <p className="text-xs text-gray-400">
    {formatDateTime(check.createdAt)} · {personName(check.user)}
    {check.requestId && ` · ХУР requestId: ${check.requestId}`}
  </p>
);

// Иргэний үнэмлэхний хаяг: үнэмлэх дээрх, эсвэл бүрэлдэхүүн хэсгээс угсарна
const cardAddress = (card) =>
  card.passportAddress ||
  [card.aimagCityName, card.soumDistrictName, card.bagKhorooName, card.addressStreetName, card.addressApartmentName, card.addressDetail]
    .filter(Boolean)
    .join(", ");

function IdCardInfo({ verification, check }) {
  const card = check.response;
  const rows = compareWithRegistry(verification, card);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        {typeof card.image === "string" && card.image && (
          <img
            src={`data:image/jpeg;base64,${card.image}`}
            alt="Иргэний үнэмлэхний зураг"
            className="h-40 w-32 shrink-0 rounded-lg border border-gray-200 object-cover"
          />
        )}
        <dl className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Регистр" value={card.regnum} />
          <Field label="Ургийн овог" value={card.surname} />
          <Field label="Овог" value={card.lastname} />
          <Field label="Нэр" value={card.firstname} />
          <Field label="Төрсөн огноо" value={registryBirthDate(card) ?? card.birthDateAsText} />
          <Field label="Хүйс" value={card.gender} />
          <Field label="Үндэс" value={card.nationality} />
          <Field label="Төрсөн газар" value={card.birthPlace} />
          <Field label="Иргэний хувийн дугаар" value={card.civilId} />
          <Field label="Үнэмлэх олгосон" value={card.passportIssueDate} />
          <Field label="Хүчинтэй хугацаа" value={card.passportExpireDate} />
          <Field label="Гадаад паспорт" value={card.passportNum} />
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Хаяг" value={cardAddress(card)} />
          </div>
        </dl>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2">Талбар</th>
              <th className="px-3 py-2">Баримтаас (Didit)</th>
              <th className="px-3 py-2">Улсын бүртгэл (ХУР)</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="px-3 py-2 text-gray-500">{row.label}</td>
                <td className="px-3 py-2">{row.document || "—"}</td>
                <td className="px-3 py-2">{row.registry || "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Badge tone={MATCH_BADGES[row.match].tone}>{MATCH_BADGES[row.match].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ХУР-ын хэсэг: шалгах form, сүүлийн регистрийн шалгалт ба иргэний үнэмлэхний мэдээлэл.
// checks: тухайн баталгаажуулалтын RegistryCheck-ууд (шинэ нь эхэндээ)
const RegistryPanel = ({ verification, checks, configured }) => {
  // ХУР-ын холболт хийгдээгүй үед хэсгийг огт харуулахгүй (lib/xyp.js-ийн XYP_ENABLED)
  if (!XYP_ENABLED) return null;

  const regnumCheck = checks.find((check) => check.operation === XYP_OPERATIONS.checkRegnum);
  const cardCheck = checks.find((check) => check.operation === XYP_OPERATIONS.idCardInfo);
  const isValid = regnumCheck?.response?.isValid;

  return (
    <Card
      title="Улсын бүртгэл (ХУР)"
      description="Регистрийн дугаар үнэн эсэх, иргэний үнэмлэхний мэдээллийг Улсын бүртгэлийн ерөнхий газраас авч баримттай тулгана."
    >
      {!configured && (
        <Message error="ХУР-ын холболт тохируулаагүй байна. Тохиргоо хийгдсэний дараа шалгах боломжтой." />
      )}
      <RegistryForm
        verificationId={verification.id}
        defaultRegnum={normalizeRegnum(verification.personalNumber ?? "")}
        disabled={!configured}
      />

      {regnumCheck && (
        <div className="space-y-2 border-t border-gray-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">Регистрийн дугаар ({regnumCheck.regnum})</h3>
            {regnumCheck.resultCode === 0 && isValid != null && (
              <Badge tone={isValid ? "green" : "red"}>{isValid ? "Зөв" : "Буруу"}</Badge>
            )}
          </div>
          <CheckError check={regnumCheck} />
          <CheckMeta check={regnumCheck} />
        </div>
      )}

      {cardCheck && (
        <div className="space-y-3 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold">Иргэний үнэмлэхний мэдээлэл</h3>
          <CheckError check={cardCheck} />
          {cardCheck.resultCode === 0 && cardCheck.response && (
            <IdCardInfo verification={verification} check={cardCheck} />
          )}
          <CheckMeta check={cardCheck} />
        </div>
      )}
    </Card>
  );
};

export default RegistryPanel;
