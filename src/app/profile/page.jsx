import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSessionPage } from "@/lib/session";
import { AppShell } from "@/components/Shells";
import { PageTitle } from "@/components/Titles";
import { PasswordForm, ProfileForm } from "./profile-forms";

export const metadata = { title: "Миний мэдээлэл" };

const ProfileContent = async () => {
  const session = await requireSessionPage();

  // Token хуучирсан байж болох тул засах утгыг DB-ээс уншина
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, firstName: true, lastName: true, contact: true, password: true },
  });
  if (!user) redirect("/login");

  return (
    <>
      <PageTitle title="Миний мэдээлэл" description="Хувийн мэдээлэл болон нууц үгээ өөрчлөх" />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ProfileForm
          user={{
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            contact: user.contact,
          }}
        />
        <PasswordForm hasPassword={Boolean(user.password)} />
      </div>
    </>
  );
};

const ProfilePage = () => (
  <AppShell>
    <ProfileContent />
  </AppShell>
);

export default ProfilePage;
