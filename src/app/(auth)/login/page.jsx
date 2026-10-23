import { Suspense } from "react";
import { Loading } from "@/components/Messages";
import LoginForm from "./login-form";

export const metadata = { title: "Нэвтрэх" };

// LoginForm нь searchParams (?error=) уншдаг тул Suspense-д ороосон
const LoginPage = () => (
  <Suspense fallback={<Loading />}>
    <LoginForm />
  </Suspense>
);

export default LoginPage;
