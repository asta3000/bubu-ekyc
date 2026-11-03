"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import EmailStep from "../_components/email-step";
import OtpStep from "../_components/otp-step";
import { Button, GoogleButton, PrimaryButton } from "@/components/Buttons";
import { Input, NewPasswordFields, ProfileFields } from "@/components/Inputs";
import { Message } from "@/components/Messages";
import { sendJson } from "@/lib/fetcher";
import { passwordMismatch } from "@/lib/validations";
import { Divider, FormFooter, StepHeader } from "../_components/form-ui";

const STEP_TITLES = {
  organization: "Бүртгүүлэх",
  email: "И-мэйл",
  otp: "И-мэйл баталгаажуулах",
  details: "Хэрэглэгчийн мэдээлэл",
};
const STEP_NUMBERS = { organization: 1, email: 2, otp: 3, details: 4 };

// Google-ээр бүртгүүлэхэд сонгосон байгууллага OAuth-ийн дараа алдагдсан эсвэл
// байгууллага сонгоогүй бол (callback-аас ?error=) харуулах мессеж
const ERRORS = {
  organization: "Байгууллагын мэдээлэл өөрчлөгдсөн эсвэл давхардсан байна. Дахин шалгаад үргэлжлүүлнэ үү.",
  "no-organization": "Бүртгэл олдсонгүй. Бүртгүүлэхийн тулд эхлээд байгууллагын мэдээллээ оруулна уу.",
};

const MODES = [
  { value: "create", label: "Шинээр бүртгэх" },
  { value: "join", label: "Байгууллагад нэгдэх" },
];

// Шинэ байгууллага бүртгэх (бүртгэсэн хэрэглэгч ORG_ADMIN болно) эсвэл харилцагчийн
// дугаараар бүртгэлтэй байгууллагад нэгдэх (энгийн хэрэглэгч болно). Энд зөвхөн шалгана,
// байгууллага хэрэглэгчтэй хамт сүүлийн алхамд (эсвэл Google-ийн callback-д) үүснэ.
const OrganizationStep = ({ initial, notice, onDone }) => {
  const [mode, setMode] = useState(initial?.mode ?? "create");
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);
  const values = initial?.mode === mode ? initial : {};

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pending) return;
    const organization = { mode, ...Object.fromEntries(new FormData(event.currentTarget)) };

    setPending(true);
    setErrors({});
    const result = await sendJson("/api/auth/register/organization", "POST", organization);
    setPending(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onDone({ ...organization, joinName: result.organization?.name ?? null });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Message error={notice} />
      <Message error={errors.form} />
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1" role="tablist">
        {MODES.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={mode === item.value}
            onClick={() => {
              setMode(item.value);
              setErrors({});
            }}
            className={`whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium ${
              mode === item.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {mode === "create" ? (
        <div key="create" className="space-y-4">
          <p className="text-sm text-gray-600">
            Байгууллагаа бүртгээд та түүний админ болно. Бусад мэдээллийг дараа нь нөхөж болно.
          </p>
          <Input
            label="Байгууллагын нэр"
            name="name"
            defaultValue={values.name}
            maxLength={100}
            error={errors.name}
            autoFocus
            required
          />
          <Input
            label="Регистрийн дугаар"
            name="registerNumber"
            defaultValue={values.registerNumber}
            inputMode="numeric"
            pattern="\d{7}"
            maxLength={7}
            error={errors.registerNumber}
            required
          />
          <Input
            label="Байгууллагын и-мэйл"
            name="email"
            type="email"
            defaultValue={values.email}
            error={errors.email}
            required
          />
          <Input
            label="Утасны дугаар"
            name="phone"
            type="tel"
            defaultValue={values.phone}
            maxLength={20}
            error={errors.phone}
            required
          />
        </div>
      ) : (
        <div key="join" className="space-y-4">
          <p className="text-sm text-gray-600">
            Байгууллагынхаа админаас харилцагчийн дугаарыг аваад оруулна уу. Та байгууллагын хэрэглэгч болно.
          </p>
          <Input
            label="Харилцагчийн дугаар"
            name="customerNumber"
            defaultValue={values.customerNumber}
            maxLength={10}
            className="font-mono tracking-wider uppercase"
            error={errors.customerNumber}
            autoFocus
            required
          />
        </div>
      )}
      <PrimaryButton pending={pending}>Үргэлжлүүлэх</PrimaryButton>
    </form>
  );
};

// Сонгосон байгууллагын товч мэдээлэл, буцаж засах товчтой
const OrganizationSummary = ({ organization, onChange }) => (
  <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
    <div>
      <p className="font-medium text-gray-900">{organization.joinName ?? organization.name}</p>
      <p className="text-xs text-gray-500">
        {organization.mode === "join" ? "Байгууллагын хэрэглэгчээр нэгдэнэ" : "Шинэ байгууллага · Та админ болно"}
      </p>
    </div>
    <Button variant="link" onClick={onChange}>
      Өөрчлөх
    </Button>
  </div>
);

const DetailsStep = ({ email, verificationToken, organization, onChangeOrganization, onExpired }) => {
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
    const { joinName, ...organizationInput } = organization;
    const result = await sendJson("/api/auth/register", "POST", {
      ...data,
      verificationToken,
      organization: organizationInput,
    });
    if (!result.ok) {
      // Баталгаажуулалтын хугацаа дууссан бол и-мэйлийн алхам руу, байгууллагын алдаа бол
      // байгууллагын алхам руу буцна
      if (result.errors.organization) return onChangeOrganization(result.errors.organization);
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
      <OrganizationSummary organization={organization} onChange={() => onChangeOrganization()} />
      <Message success={`${email} баталгаажлаа`} />
      <Message error={errors.form} />
      <ProfileFields errors={errors} />
      <NewPasswordFields errors={errors} label="Нууц үг" />
      <PrimaryButton pending={pending}>Бүртгүүлэх</PrimaryButton>
    </form>
  );
};

const RegisterForm = () => {
  const error = useSearchParams().get("error");
  const [step, setStep] = useState("organization");
  const [email, setEmail] = useState("");
  const [resendIn, setResendIn] = useState(60);
  const [verificationToken, setVerificationToken] = useState("");
  const [notice, setNotice] = useState("");
  const [organization, setOrganization] = useState(null);
  const [organizationNotice, setOrganizationNotice] = useState(ERRORS[error] ?? "");

  // Баталгаажуулалтын хугацаа дууссан бол и-мэйлийн алхам руу буцна (байгууллага хэвээр)
  const expire = (message) => {
    setNotice(message ?? "Дахин эхлүүлнэ үү");
    setStep("email");
  };

  // Байгууллагын алхам руу буцна. message: сүүлийн алхамд гарсан байгууллагын алдаа
  const changeOrganization = (message) => {
    setOrganizationNotice(message ?? "");
    setStep("organization");
  };

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
      <StepHeader title={STEP_TITLES[step]} step={STEP_NUMBERS[step]} total={4} />

      {step === "organization" && (
        <OrganizationStep
          initial={organization}
          notice={organizationNotice}
          onDone={(value) => {
            setOrganization(value);
            setOrganizationNotice("");
            setStep("email");
          }}
        />
      )}

      {step === "email" && (
        <>
          <OrganizationSummary organization={organization} onChange={() => changeOrganization()} />
          <Message error={notice} />
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
          organization={organization}
          onChangeOrganization={changeOrganization}
          onExpired={expire}
        />
      )}

      <FormFooter text="Бүртгэлтэй юу?" href="/login">
        Нэвтрэх
      </FormFooter>
    </div>
  );
};

export default RegisterForm;
