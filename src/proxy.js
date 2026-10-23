import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Нэвтэрсэн хэрэглэгч орох шаардлагагүй хуудсууд
const AUTH_PAGES = ["/login", "/register", "/recovery"];

// Session шаардахгүй замууд: Auth.js, бүртгэл, нууц үг сэргээх API,
// Vercel Cron (CRON_SECRET-ээр өөрөө шалгана), QPay callback (QPay-ээс өөрөөс нь шалгана),
// хэвлэсэн баримт шалгах (QR-ын гарын үсгээр шалгана)
const PUBLIC_PATHS = ["/api/auth", "/api/cron", "/api/payments/qpay/callback", "/verify"];

// Role-оор хамгаалах замууд. Илүү нарийн замыг эхэнд бичнэ.
const ROLE_RULES = [
  { prefix: "/admins", roles: ["ADMIN"] },
  { prefix: "/api/admins", roles: ["ADMIN"] },
  { prefix: "/managements", roles: ["ADMIN"] },
  { prefix: "/api/managements", roles: ["ADMIN"] },
  { prefix: "/organizations", roles: ["ADMIN", "ORGANIZATION"] },
  { prefix: "/api/organizations", roles: ["ADMIN", "ORGANIZATION"] },
];

// Нүүр хуудаснаас эрх бүрийн үндсэн хуудас руу (хуудсууд нэмэгдэхэд бөглөнө)
const ROLE_HOME = { ADMIN: "/managements", ORGANIZATION: "/organizations/match" };

// Өөрийн хуудасгүй замуудын эхний хуудас
const INDEX_REDIRECTS = {
  "/managements": "/managements/operations",
  "/organizations": "/organizations/match",
};

const matches = (pathname, prefix) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

// auth() нь энд session cookie-г уншиж, access token дууссан бол
// refresh хийгээд шинэ cookie-г хариунд нэмж өгнө.
export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;
  const user = request.auth?.user;
  const isApi = pathname.startsWith("/api");

  if (PUBLIC_PATHS.some((prefix) => matches(pathname, prefix))) {
    return NextResponse.next();
  }

  if (AUTH_PAGES.some((prefix) => matches(pathname, prefix))) {
    return user ? NextResponse.redirect(new URL("/", request.nextUrl)) : NextResponse.next();
  }

  // Token байхгүй эсвэл хугацаа нь дууссан (нүүр хуудас "/" ч мөн адил /login руу)
  if (!user) {
    if (isApi) {
      return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  const rule = ROLE_RULES.find(({ prefix }) => matches(pathname, prefix));
  if (rule && !rule.roles.includes(user.role)) {
    if (isApi) {
      return NextResponse.json({ error: "Хандах эрхгүй" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  const redirectTo = pathname === "/" ? ROLE_HOME[user.role] : INDEX_REDIRECTS[pathname];
  if (redirectTo) return NextResponse.redirect(new URL(redirectTo, request.nextUrl));

  return NextResponse.next();
});

export const config = {
  // Static файл, зурагнаас бусад бүх хүсэлт дээр ажиллана
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
