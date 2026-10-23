"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendForm, sendJson } from "@/lib/fetcher";

// Form-ын хүсэлт илгээх нийтлэг hook: pending, талбарын алдаа (errors), амжилтын мессеж
// (success). Амжилттай бол хуудасны өгөгдлийг дахин уншина (refresh: false-оор болиулна).
// data нь FormData бол (файлтай) multipart-аар илгээнэ.
//   submit(url, method, data) → амжилттай эсэх (boolean)
//   send(url, method, data)   → fetcher-ийн бүтэн хариу ({ ok, ...body })
export function useSubmit({ refresh = true } = {}) {
  const router = useRouter();
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(null);
  const [pending, setPending] = useState(false);

  const send = async (url, method, data) => {
    setPending(true);
    const result =
      data instanceof FormData ? await sendForm(url, method, data) : await sendJson(url, method, data);
    setPending(false);
    setErrors(result.ok ? {} : result.errors);
    setSuccess(result.ok ? (result.message ?? null) : null);
    if (result.ok && refresh) router.refresh();
    return result;
  };

  const submit = async (url, method, data) => (await send(url, method, data)).ok;

  return { errors, setErrors, success, pending, send, submit };
}
