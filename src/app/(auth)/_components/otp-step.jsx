"use client";

import { useEffect, useState } from "react";
import { Button, PrimaryButton } from "@/components/Buttons";
import { Input } from "@/components/Inputs";
import { Message } from "@/components/Messages";

// 6 оронтой OTP оруулах алхам. 6 орон бөглөгдөхөд автоматаар шалгана.
const OtpStep = ({ email, initialResendIn = 60, onVerify, onResend, onBack }) => {
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState({});
  const [info, setInfo] = useState("");
  const [pending, setPending] = useState(false);
  const [resendIn, setResendIn] = useState(initialResendIn);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const verify = async (value) => {
    if (pending || !/^\d{6}$/.test(value)) {
      setErrors({ code: "6 оронтой код оруулна уу" });
      return;
    }
    setPending(true);
    setErrors({});
    const result = await onVerify(value);
    if (result?.errors) {
      setErrors(result.errors);
      setCode("");
    }
    setPending(false);
  };

  const resend = async () => {
    setErrors({});
    setInfo("");
    const result = await onResend();
    if (result?.errors) setErrors(result.errors);
    else setInfo("Шинэ код илгээлээ");
    setResendIn(result?.resendIn ?? 60);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        verify(code);
      }}
      className="space-y-4"
    >
      <p className="text-sm text-gray-600">
        <span className="font-medium text-gray-900">{email}</span> хаяг руу 6 оронтой код
        илгээлээ.
      </p>
      <Message error={errors.form} success={info} />
      <Input
        label="Баталгаажуулах код"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        value={code}
        onChange={(event) => {
          const value = event.target.value.replace(/\D/g, "").slice(0, 6);
          setCode(value);
          if (value.length === 6) verify(value);
        }}
        className="text-center text-lg tracking-[0.5em]"
        error={errors.code}
      />
      <PrimaryButton pending={pending}>Баталгаажуулах</PrimaryButton>
      <div className="flex justify-between text-sm">
        <Button variant="link" onClick={onBack}>
          И-мэйл солих
        </Button>
        <Button variant="link" onClick={resend} disabled={resendIn > 0}>
          {resendIn > 0 ? `Дахин илгээх (${resendIn})` : "Дахин илгээх"}
        </Button>
      </div>
    </form>
  );
};

export default OtpStep;
