"use client";

import { useState } from "react";
import { emailSchema } from "@/lib/validations";
import { PrimaryButton } from "@/components/Buttons";
import { Input } from "@/components/Inputs";
import { Message } from "@/components/Messages";

// И-мэйл оруулах алхам. Zod-оор шууд шалгаж, бүрэн зөв и-мэйл бичээд
// талбараас гарах (blur) эсвэл товч дарахад onSubmit дуудагдана.
const EmailStep = ({ defaultEmail = "", submitLabel, onSubmit }) => {
  const [email, setEmail] = useState(defaultEmail);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState(null);

  const parsed = emailSchema.safeParse(email);
  const validationError = touched && !parsed.success ? parsed.error.issues[0].message : null;

  const submit = async () => {
    setTouched(true);
    if (!parsed.success || pending || submittedEmail === parsed.data) return;

    setPending(true);
    setErrors({});
    setSubmittedEmail(parsed.data);
    const result = await onSubmit(parsed.data);
    if (result?.errors) {
      setErrors(result.errors);
      setSubmittedEmail(null);
    }
    setPending(false);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-4"
      noValidate
    >
      <Message error={errors.form} />
      <Input
        label="И-мэйл"
        name="email"
        type="email"
        autoComplete="email"
        autoFocus
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          setErrors({});
        }}
        onBlur={() => {
          setTouched(true);
          if (parsed.success) submit();
        }}
        error={validationError ?? errors.email}
      />
      <PrimaryButton pending={pending}>{submitLabel}</PrimaryButton>
    </form>
  );
};

export default EmailStep;
