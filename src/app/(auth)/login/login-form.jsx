"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import EmailStep from "../_components/email-step";
import OtpStep from "../_components/otp-step";
import { Button, GoogleButton, PrimaryButton } from "@/components/Buttons";
import { Input } from "@/components/Inputs";
import { TextLink } from "@/components/Links";
import { Message } from "@/components/Messages";
import { sendJson } from "@/lib/fetcher";
import { Divider, FormFooter, StepHeader } from "../_components/form-ui";

// Auth.js-ийн ?error= кодуудыг мессеж болгоно (Google нэвтрэлт амжилтгүй болох үед)
const AUTH_ERRORS = {
  AccessDenied: "Google бүртгэлийн и-мэйл баталгаажаагүй эсвэл нэвтрэх эрхгүй байна",
  Configuration: "Нэвтрэх тохиргоонд алдаа гарлаа, дараа дахин оролдоно уу",
  AccountInactive: "Таны бүртгэл идэвхгүй байна. Админтай холбогдоно уу.",
};

const PasswordStep = ({ email, onBack }) => {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setPending(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password: new FormData(event.currentTarget).get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError(
        result.code === "inactive"
          ? AUTH_ERRORS.AccountInactive
          : "И-мэйл эсвэл нууц үг буруу байна",
      );
      setPending(false);
      return;
    }

    // Бүтэн хуудсаар /login руу: proxy эрхийнх нь үндсэн хуудас руу шилжүүлнэ
    window.location.assign("/login");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
        <span className="truncate font-medium">{email}</span>
        <Button variant="link" onClick={onBack}>
          Солих
        </Button>
      </div>
      <Message error={error} />
      <Input
        label="Нууц үг"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
      />
      <div className="text-right">
        <TextLink href="/recovery">Нууц үгээ мартсан уу?</TextLink>
      </div>
      <PrimaryButton pending={pending}>Нэвтрэх</PrimaryButton>
    </form>
  );
};

const LoginForm = () => {
  const authError = useSearchParams().get("error");
  const [notice] = useState(
    authError ? (AUTH_ERRORS[authError] ?? "Нэвтрэхэд алдаа гарлаа") : "",
  );
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [resendIn, setResendIn] = useState(60);
  // И-мэйл баталгаажаагүй үед OTP алхам нэмэгдэж 3 алхамтай болно
  const [needsOtp, setNeedsOtp] = useState(false);

  const startLogin = (value) => sendJson("/api/auth/login/start", "POST", { email: value });

  const handleEmail = async (value) => {
    const result = await startLogin(value);
    if (!result.ok) return result;
    setEmail(value);
    setNeedsOtp(result.next === "otp");
    setResendIn(result.resendIn ?? 60);
    setStep(result.next);
  };

  const handleVerify = async (code) => {
    const result = await sendJson("/api/auth/login/verify", "POST", { email, code });
    if (!result.ok) return result;
    setStep("password");
  };

  const total = needsOtp ? 3 : 2;
  const stepNumber = { email: 1, otp: 2, password: total }[step];
  const title = step === "otp" ? "И-мэйл баталгаажуулах" : "Нэвтрэх";

  return (
    <div className="space-y-4">
      <StepHeader title={title} step={stepNumber} total={total} />
      {step === "email" && <Message error={notice} />}

      {step === "email" && (
        <>
          <GoogleButton />
          <Divider />
          <EmailStep defaultEmail={email} submitLabel="Үргэлжлүүлэх" onSubmit={handleEmail} />
        </>
      )}

      {step === "otp" && (
        <OtpStep
          email={email}
          initialResendIn={resendIn}
          onVerify={handleVerify}
          onResend={() => startLogin(email)}
          onBack={() => setStep("email")}
        />
      )}

      {step === "password" && <PasswordStep email={email} onBack={() => setStep("email")} />}

      <FormFooter text="Бүртгэлгүй юу?" href="/register">
        Бүртгүүлэх
      </FormFooter>
    </div>
  );
};

export default LoginForm;
