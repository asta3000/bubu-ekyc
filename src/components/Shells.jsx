import { Suspense } from "react";
import { subscribedServices } from "@/lib/billing/subscriptions";
import { requireAdminPage, requireSessionPage } from "@/lib/session";
import { Navbar } from "./Bars";
import { Loading } from "./Messages";

const ShellContent = async ({ admin, children }) => {
  const { user } = admin ? await requireAdminPage() : await requireSessionPage();
  // Байгууллагын хэрэглэгчид багцад нь багтсан үйлчилгээний цэсийг л харуулна (админд бүгд)
  const services = user.role !== "ADMIN" && user.organizationId ? await subscribedServices(user.organizationId) : null;

  return (
    <>
      <Navbar user={user} services={services} />
      <main className="w-full flex-1 space-y-6 px-4 py-8">{children}</main>
    </>
  );
};

// Нэвтэрсэн хэрэглэгчийн хуудасны бүтэц: navbar ба үндсэн хэсэг.
// admin бол зөвхөн ADMIN-д. Session-ийг request үед уншдаг тул cacheComponents-д
// Suspense-д ороосон. Shared layout-д ашиглавал доорх page бүр өөрийн loading.jsx-тэй байна.
export const AppShell = ({ admin = false, children }) => (
  <div className="flex flex-1 flex-col bg-gray-50">
    <Suspense fallback={<Loading className="p-4" />}>
      <ShellContent admin={admin}>{children}</ShellContent>
    </Suspense>
  </div>
);
