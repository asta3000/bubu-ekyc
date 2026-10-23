import { Suspense } from "react";
import { Loading } from "@/components/Messages";
import RecoveryForm from "./recovery-form";

export const metadata = { title: "Нууц үг сэргээх" };

// RecoveryForm нь searchParams (token) уншдаг тул Suspense-д ороосон
const RecoveryPage = () => (
  <Suspense fallback={<Loading />}>
    <RecoveryForm />
  </Suspense>
);

export default RecoveryPage;
