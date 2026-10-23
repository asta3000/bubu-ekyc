import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logAuthEvent } from "@/lib/auth-log";
import { loginSchema } from "@/lib/validations";
import {
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  nowInSeconds,
  passwordFingerprint,
} from "@/lib/tokens";

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  contact: true,
  role: true,
  password: true,
  isEmailVerified: true,
  status: true,
  organizationId: true,
  organization: { select: { name: true } },
};

// Идэвхгүй бүртгэл. code нь signIn()-ийн үр дүнд ирж, нэвтрэх хуудсанд мессеж харуулна.
class InactiveAccountError extends CredentialsSignin {
  code = "inactive";
}

function toTokenUser(user) {
  return {
    sub: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    contact: user.contact,
    role: user.role,
    hasPassword: Boolean(user.password),
    pwd: passwordFingerprint(user.password),
    organizationId: user.organizationId ?? null,
    organizationName: user.organization?.name ?? null,
  };
}

// Хэрэглэгчийг DB-ээс дахин уншиж token-ийг шинэчилнэ. Устгагдсан, идэвхгүй
// болсон эсвэл нууц үг нь өөр газар солигдсон бол null (session дуусна).
// newPwd: нууц үг солих API-аас ирэх шинэ хэвлэмж. Энэ нь client-д хэзээ ч
// ил гардаггүй тул хуучин session-оор update дуудаж сэргээх боломжгүй.
async function reloadToken(token, newPwd) {
  const dbUser = await prisma.user.findUnique({
    where: { id: token.sub },
    select: userSelect,
  });
  if (!dbUser || dbUser.status !== "ACTIVE") return null;

  const pwd = passwordFingerprint(dbUser.password);
  if (pwd !== token.pwd && pwd !== newPwd) return null;

  return {
    ...token,
    ...toTokenUser(dbUser),
    accessTokenExpires: nowInSeconds() + ACCESS_TOKEN_MAX_AGE,
  };
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  // Session cookie нь refresh token-ийн хугацаагаар (30 хоног) хадгалагдана
  session: { strategy: "jwt", maxAge: REFRESH_TOKEN_MAX_AGE },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    // AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET-ийг .env-ээс автоматаар уншина
    Google,
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email }, select: userSelect });
        // Амжилтгүй оролдлогыг шалтгаантай нь бүртгээд null буцаана
        const fail = async (reason) => {
          await logAuthEvent({
            event: "LOGIN_FAILED",
            email,
            userId: user?.id,
            provider: "credentials",
            reason,
          });
          return null;
        };

        // Google-ээр бүртгүүлж нууц үг тохируулаагүй, эсвэл и-мэйлээ OTP-оор
        // баталгаажуулаагүй хэрэглэгч нууц үгээр нэвтрэхгүй
        if (!user || user.status === "DELETED") return fail("user_not_found");
        if (!user.password) return fail("no_password");
        if (!user.isEmailVerified) return fail("email_not_verified");

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) return fail("wrong_password");

        // Нууц үг зөв ч бүртгэл идэвхгүй бол тусгай мессеж харуулна
        if (user.status !== "ACTIVE") {
          await fail("inactive");
          throw new InactiveAccountError();
        }

        return user;
      },
    }),
  ],
  // Амжилттай нэвтрэлт ба гаралтыг лог-д бүртгэнэ
  events: {
    async signIn({ user, account }) {
      const email = user.email.toLowerCase();
      // Google-ийн user.id нь Google-ийн id тул DB-ийн id-г и-мэйлээр олно
      const userId =
        account?.provider === "google"
          ? (await prisma.user.findUnique({ where: { email }, select: { id: true } }))?.id
          : user.id;
      await logAuthEvent({ event: "LOGIN", email, userId, provider: account?.provider });
    },
    async signOut(message) {
      const token = message.token;
      if (!token?.sub) return;
      await logAuthEvent({ event: "LOGOUT", email: token.email, userId: token.sub });
    },
  },
  callbacks: {
    // Google-ээр нэвтрэхэд и-мэйлээр нь хэрэглэгчийг олж, байхгүй бол үүсгэнэ
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      if (!profile?.email || !profile.email_verified) {
        await logAuthEvent({
          event: "LOGIN_FAILED",
          email: profile?.email,
          provider: "google",
          reason: "email_not_verified",
        });
        return false;
      }

      const email = profile.email.toLowerCase();
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, isEmailVerified: true, status: true },
      });
      // Идэвхгүй эсвэл устгагдсан бүртгэлээр Google-ээр нэвтрүүлэхгүй
      if (existing && existing.status !== "ACTIVE") {
        await logAuthEvent({
          event: "LOGIN_FAILED",
          email,
          userId: existing.id,
          provider: "google",
          reason: "inactive",
        });
        return "/login?error=AccountInactive";
      }

      const user = await prisma.user.upsert({
        where: { email },
        // Баталгаажаагүй бүртгэлийн нууц үгийг өөр хүн тохируулсан байж болзошгүй
        // тул устгана. Хэрэглэгч хүсвэл "Нууц үг сэргээх"-ээр шинээр тохируулна.
        update: existing?.isEmailVerified
          ? {}
          : { isEmailVerified: true, password: null },
        create: {
          email,
          firstName: profile.given_name ?? profile.name ?? email.split("@")[0],
          lastName: profile.family_name ?? "",
          // Google холбоо барих мэдээлэл өгөхгүй тул хоосон үлдээнэ
          contact: "",
          isEmailVerified: true,
        },
        select: { id: true },
      });
      if (!existing) {
        await logAuthEvent({ event: "REGISTER", email, userId: user.id, provider: "google" });
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      const now = nowInSeconds();

      // Анх нэвтрэх үед access болон refresh token-ийн хугацааг тогтооно
      if (user) {
        // Google-ийн user объект нь Google-ийн id-тай тул DB-ийн хэрэглэгчийг авна
        const dbUser =
          account?.provider === "google"
            ? await prisma.user.findUnique({
                where: { email: user.email.toLowerCase() },
                select: userSelect,
              })
            : user;
        if (!dbUser || dbUser.status !== "ACTIVE") return null;

        return {
          ...token,
          ...toTokenUser(dbUser),
          accessTokenExpires: now + ACCESS_TOKEN_MAX_AGE,
          refreshTokenExpires: now + REFRESH_TOKEN_MAX_AGE,
        };
      }

      // Хэрэглэгч мэдээлэл/нууц үгээ өөрчлөхөд серверээс unstable_update() дуудагдана.
      // Ирсэн өгөгдлөөс зөвхөн pwd-г шалгалтад ашиглаж, бусдыг DB-ээс дахин уншина.
      if (trigger === "update") return reloadToken(token, session?.pwd);

      if (now < token.accessTokenExpires) return token;

      // Refresh token дууссан бол session-ийг устгана (null буцаахад cookie цэвэрлэгдэнэ)
      if (!token.refreshTokenExpires || now >= token.refreshTokenExpires) return null;

      // Access token дууссан: хэрэглэгчийг DB-ээс дахин шалгаж шинэчилнэ
      return reloadToken(token);
    },
    session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.sub,
        email: token.email,
        firstName: token.firstName,
        lastName: token.lastName,
        name: `${token.lastName} ${token.firstName}`,
        contact: token.contact,
        role: token.role,
        hasPassword: token.hasPassword,
        organizationId: token.organizationId,
        organizationName: token.organizationName,
      };
      session.accessTokenExpires = token.accessTokenExpires;
      session.refreshTokenExpires = token.refreshTokenExpires;
      return session;
    },
  },
});
