"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrimaryButton } from "@/components/Buttons";
import { Input, NewPasswordFields } from "@/components/Inputs";
import { TextLink } from "@/components/Links";
import { Message } from "@/components/Messages";
import { PageTitle } from "@/components/Titles";
import { sendJson } from "@/lib/fetcher";
import { passwordMismatch } from "@/lib/validations";
import { FormFooter } from "../_components/form-ui";

const RequestResetForm = () => {
  const [state, setState] = useState({ errors: {} });
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setPending(true);
    const { email } = Object.fromEntries(new FormData(event.currentTarget));
    const result = await sendJson("/api/auth/forgot-password", "POST", { email });
    setState(result.ok ? { errors: {}, success: result.message } : { errors: result.errors });
    setPending(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PageTitle
        title="Нууц үг сэргээх"
        description="Бүртгэлтэй и-мэйл хаягаа оруулбал сэргээх линк илгээнэ."
      />
      <Message error={state.errors.form} success={state.success} />
      <Input label="И-мэйл" name="email" type="email" autoComplete="email" error={state.errors.email} required />
      <PrimaryButton pending={pending}>Линк илгээх</PrimaryButton>
    </form>
  );
};

const ResetPasswordForm = ({ token }) => {
  const [state, setState] = useState({ errors: {} });
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const mismatch = passwordMismatch(form);
    if (mismatch) {
      setState({ errors: mismatch });
      return;
    }

    setPending(true);
    const result = await sendJson("/api/auth/reset-password", "POST", { token, password: form.password });
    setState(
      result.ok
        ? { errors: {}, success: result.message, done: true }
        : { errors: result.errors },
    );
    setPending(false);
  };

  if (state.done) {
    return (
      <div className="space-y-4">
        <Message success={state.success} />
        <TextLink href="/login" className="block text-center">
          Нэвтрэх
        </TextLink>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PageTitle title="Шинэ нууц үг" />
      <Message error={state.errors.form ?? state.errors.token} />
      <NewPasswordFields errors={state.errors} />
      <PrimaryButton pending={pending}>Хадгалах</PrimaryButton>
    </form>
  );
};

const RecoveryForm = () => {
  const token = useSearchParams().get("token");

  return (
    <div className="space-y-4">
      {token ? <ResetPasswordForm token={token} /> : <RequestResetForm />}
      <FormFooter href="/login">Нэвтрэх хуудас руу буцах</FormFooter>
    </div>
  );
};

export default RecoveryForm;
