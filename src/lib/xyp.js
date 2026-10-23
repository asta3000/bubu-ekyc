import { createSign } from "node:crypto";
import https from "node:https";
import { XMLParser } from "fast-xml-parser";

// ХУР (Төрийн мэдээлэл солилцооны систем) веб сервис, v1.5.0. https://developer.xyp.gov.mn
// SOAP хүсэлт бүрт accessToken, timeStamp, signature header илгээнэ. signature нь
// "accessToken.timeStamp" мөрийг RSA-SHA256-аар гарын үсэг зурж Base64 болгосон утга.

// ХУР-ын холболт (VPN, токен) хийгдээгүй тул түр унтраав. Холболт хийсний дараа true болгоно:
// баталгаажуулалтын хуудсанд "Улсын бүртгэл (ХУР)" хэсэг гарч, API ажиллана.
export const XYP_ENABLED = false;

export const XYP_OPERATIONS = {
  checkRegnum: "WS100125_checkCitizenRegnum",
  idCardInfo: "WS100101_getCitizenIDCardInfo",
};

export const XYP_RESULT_CODES = {
  0: "Амжилттай",
  1: "Мэдээлэл олдсонгүй",
  2: "ХУР-ын дотоод алдаа",
  3: "Хүсэлт буруу (токен, гарын үсэг, оролтыг шалгана уу)",
};

const NAMESPACE = "http://citizen.xyp.gov.mn/";
const DEFAULT_ENDPOINT = "https://xyp.gov.mn/citizen-1.5.0/ws";
const TIMEOUT_MS = 30_000;

export class XypError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function config() {
  return {
    endpoint: (process.env.XYP_ENDPOINT || DEFAULT_ENDPOINT).replace(/\?wsdl$/i, ""),
    accessToken: process.env.XYP_ACCESS_TOKEN,
    // Env-д нэг мөрөнд хадгалсан PEM-ийн \n-ийг жинхэнэ мөр шилжилт болгоно
    privateKey: process.env.XYP_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    ca: process.env.XYP_CA_CERT?.replace(/\\n/g, "\n") || undefined,
  };
}

export const isXypConfigured = () => {
  const { accessToken, privateKey } = config();
  return Boolean(accessToken && privateKey);
};

// Хүсэлт бүрт шинэ timeStamp (Unix секунд) ба гарын үсэг
function authHeaders({ accessToken, privateKey }) {
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const signer = createSign("SHA256");
  signer.update(`${accessToken}.${timeStamp}`, "utf8");
  signer.end();
  return { accessToken, timeStamp, signature: signer.sign(privateKey, "base64") };
}

const escapeXml = (value) =>
  String(value).replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);

// { regnum: "..", auth: { citizen: {...} } } → <regnum>..</regnum><auth>...</auth>.
// null/undefined нь хоосон элемент (ХУР ашиглахгүй талбарыг хоосноор хүлээн авна).
const toXml = (value) =>
  Object.entries(value)
    .map(([key, item]) =>
      item != null && typeof item === "object" ? `<${key}>${toXml(item)}</${key}>` : `<${key}>${item == null ? "" : escapeXml(item)}</${key}>`,
    )
    .join("");

const envelope = (operation, request) =>
  `<?xml version="1.0" encoding="utf-8"?>` +
  `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${NAMESPACE}">` +
  `<soap:Body><tns:${operation}><request>${toXml(request)}</request></tns:${operation}></soap:Body>` +
  `</soap:Envelope>`;

// fetch нь өөрийн CA (Монголын үндэсний гэрчилгээ) зааж өгөх боломжгүй тул node:https
function post(url, body, headers, ca) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(body),
          SOAPAction: '""',
          ...headers,
        },
        ca,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("хүсэлтийн хугацаа хэтэрлээ")));
    req.on("error", reject);
    req.end(body);
  });
}

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  // Регистр, хувийн дугаарын эхний 0 алдагдахгүйн тулд string хэвээр
  parseTagValue: false,
  trimValues: true,
});

// Сервис дуудаж { resultCode, resultMessage, requestId, response } буцаана.
// resultCode 0 (амжилттай) эсвэл 1 (олдсонгүй) биш байсан ч алдаа шидэхгүй, дуудагч шийднэ.
async function call(operation, request) {
  const settings = config();
  if (!isXypConfigured()) throw new XypError("ХУР-ын холболт тохируулаагүй байна", 503);

  let result;
  try {
    result = await post(settings.endpoint, envelope(operation, request), authHeaders(settings), settings.ca);
  } catch (error) {
    throw new XypError(`ХУР-тай холбогдож чадсангүй: ${error.message}`);
  }

  let body;
  try {
    body = parser.parse(result.text).Envelope?.Body;
  } catch {
    body = null;
  }
  if (body?.Fault) throw new XypError(`ХУР: ${body.Fault.faultstring ?? "SOAP алдаа"}`);
  const data = body?.[`${operation}Response`]?.return;
  if (!data) throw new XypError(`ХУР-аас буруу хариу ирлээ (HTTP ${result.status})`);

  return {
    resultCode: data.resultCode != null && data.resultCode !== "" ? Number(data.resultCode) : null,
    resultMessage: data.resultMessage || null,
    requestId: data.requestId || null,
    response: data.response || null,
  };
}

// citizenAuth: иргэний зөвшөөрөл шаардах сервист { authType, otp, ... } (ХУР-ын заавар).
// Одоогоор байгууллагын эрхээр (иргэний баталгаажуулалтгүй) дуудна.
const withAuth = (request, citizenAuth) => (citizenAuth ? { ...request, auth: { citizen: citizenAuth } } : request);

// WS100125: регистрийн дугаар үнэн эсэх. response.isValid нь "true" | "false"
export async function checkCitizenRegnum(regnum, citizenAuth) {
  const result = await call(XYP_OPERATIONS.checkRegnum, withAuth({ regnum }, citizenAuth));
  const isValid = result.response?.isValid;
  return { ...result, response: { isValid: isValid == null ? null : String(isValid) === "true" } };
}

// WS100101: иргэний үнэмлэхний мэдээлэл (нэр, төрсөн огноо, хаяг, зураг г.м.)
export const getCitizenIdCardInfo = ({ regnum, civilId }, citizenAuth) =>
  call(XYP_OPERATIONS.idCardInfo, withAuth({ regnum, civilId: civilId || null }, citizenAuth));
