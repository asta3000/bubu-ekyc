"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import EmailStep from "../_components/email-step";
import OtpStep from "../_components/otp-step";
import { GoogleButton, PrimaryButton } from "@/components/Buttons";
import { NewPasswordFields, ProfileFields } from "@/components/Inputs";
import { Message } from "@/components/Messages";
import { sendJson } from "@/lib/fetcher";
import { passwordMismatch } from "@/lib/validations";
import { Divider, FormFooter, StepHeader } from "../_components/form-ui";

const STEP_TITLES = { email: "Бүртгүүлэх", otp: "И-мэйл баталгаажуулах", details: "Мэдээлэл" };
const STEP_NUMBERS = { email: 1, otp: 2, details: 3 };


const DetailsStep = ({ email, verificationToken, onExpired }) => {
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));

    const mismatch = passwordMismatch(form);
    if (mismatch) {
      setErrors(mismatch);
      return;
    }

    setPending(true);
    setErrors({});

    const { confirmPassword, ...data } = form;
    const result = await sendJson("/api/auth/register", "POST", { ...data, verificationToken });
    if (!result.ok) {
      // Баталгаажуулалтын хугацаа дууссан бол эхний алхам руу буцна
      if (result.errors.form) onExpired?.(result.errors.form);
      setErrors(result.errors);
      setPending(false);
      return;
    }

    // Бүртгэл амжилттай бол шууд нэвтрүүлнэ. Нэвтэрсэн бол proxy /login-оос эрхийнх нь
    // хуудас руу шилжүүлнэ, үгүй бол /login хэвээр харагдана.
    await signIn("credentials", { email, password: data.password, redirect: false });
    window.location.assign("/login");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Message success={`${email} баталгаажлаа`} />
      <Message error={errors.form} />
      <ProfileFields errors={errors} />
      <NewPasswordFields errors={errors} label="Нууц үг" />
      <PrimaryButton pending={pending}>Бүртгүүлэх</PrimaryButton>
    </form>
  );
};

const RegisterForm = () => {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [resendIn, setResendIn] = useState(60);
  const [verificationToken, setVerificationToken] = useState("");
  const [notice, setNotice] = useState("");

  const sendOtp = (value) => sendJson("/api/auth/register/start", "POST", { email: value });

  const handleEmail = async (value) => {
    setNotice("");
    const result = await sendOtp(value);
    if (!result.ok) return result;
    setEmail(value);
    setResendIn(result.resendIn);
    setStep("otp");
  };

  const handleVerify = async (code) => {
    const result = await sendJson("/api/auth/register/verify", "POST", { email, code });
    if (!result.ok) return result;
    setVerificationToken(result.verificationToken);
    setStep("details");
  };

  return (
    <div className="space-y-4">
      <StepHeader title={STEP_TITLES[step]} step={STEP_NUMBERS[step]} total={3} />
      <Message error={notice} />

      {step === "email" && (
        <>
          <GoogleButton>Google-ээр бүртгүүлэх</GoogleButton>
          <Divider />
          <EmailStep defaultEmail={email} submitLabel="Код илгээх" onSubmit={handleEmail} />
        </>
      )}

      {step === "otp" && (
        <OtpStep
          email={email}
          initialResendIn={resendIn}
          onVerify={handleVerify}
          onResend={() => sendOtp(email)}
          onBack={() => setStep("email")}
        />
      )}

      {step === "details" && (
        <DetailsStep
          email={email}
          verificationToken={verificationToken}
          onExpired={(message) => {
            setNotice(message ?? "Дахин эхлүүлнэ үү");
            setStep("email");
          }}
        />
      )}

      <FormFooter text="Бүртгэлтэй юу?" href="/login">
        Нэвтрэх
      </FormFooter>
    </div>
  );
};

export default RegisterForm;
