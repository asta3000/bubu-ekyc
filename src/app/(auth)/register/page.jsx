import { Suspense } from "react";
import { Loading } from "@/components/Messages";
import RegisterForm from "./register-form";

export const metadata = { title: "Бүртгүүлэх" };

// RegisterForm нь searchParams (?error=) уншдаг тул Suspense-д ороосон
const RegisterPage = () => (
  <Suspense fallback={<Loading />}>
    <RegisterForm />
  </Suspense>
);

export default RegisterPage;
