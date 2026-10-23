"use client";

import { PrimaryButton } from "@/components/Buttons";
import { Card } from "@/components/Cards";
import { Input, NewPasswordFields, ProfileFields } from "@/components/Inputs";
import { Message } from "@/components/Messages";
import { useSubmit } from "@/lib/use-submit";
import { passwordMismatch } from "@/lib/validations";

export const ProfileForm = ({ user }) => {
  // Амжилттай бол хуудсыг дахин уншиж navbar дахь нэрийг шинэчилнэ
  const { errors, success, pending, submit } = useSubmit();

  const handleSubmit = (event) => {
    event.preventDefault();
    submit("/api/profile", "PATCH", Object.fromEntries(new FormData(event.currentTarget)));
  };

  return (
    <Card title="Хувийн мэдээлэл">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Message error={errors.form} success={success} />
        <Input label="И-мэйл" value={user.email} disabled readOnly />
        <ProfileFields errors={errors} user={user} />
        <PrimaryButton pending={pending}>Хадгалах</PrimaryButton>
      </form>
    </Card>
  );
};

// hasPassword: Google-ээр бүртгүүлж нууц үг тохируулаагүй бол false
export const PasswordForm = ({ hasPassword }) => {
  // Амжилттай бол хуудсыг дахин уншина: нууц үггүй байсан бол "Одоогийн нууц үг" талбар гарна
  const { errors, setErrors, success, pending, submit } = useSubmit();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const mismatch = passwordMismatch(data);
    if (mismatch) {
      setErrors(mismatch);
      return;
    }
    const ok = await submit("/api/profile/password", "POST", {
      currentPassword: data.currentPassword,
      password: data.password,
    });
    if (ok) form.reset();
  };

  return (
    <Card
      title={hasPassword ? "Нууц үг солих" : "Нууц үг тохируулах"}
      description={
        hasPassword
          ? "Солисны дараа бусад төхөөрөмж дээрх нэвтрэлт дуусна."
          : "Google-ээр нэвтэрдэг бүртгэлдээ нууц үг тохируулбал и-мэйл, нууц үгээр ч нэвтэрч болно."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Message error={errors.form} success={success} />
        {hasPassword && (
          <Input
            label="Одоогийн нууц үг"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            error={errors.currentPassword}
            required
          />
        )}
        <NewPasswordFields errors={errors} />
        <PrimaryButton pending={pending}>{hasPassword ? "Нууц үг солих" : "Тохируулах"}</PrimaryButton>
      </form>
    </Card>
  );
};
