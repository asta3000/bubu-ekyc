"use client";

import { useEffect } from "react";
import { Button } from "@/components/Buttons";

// Хуудсан дээр гарсан алдааг харуулна. Error boundary байхгүй үед Suspense доторх серверийн
// алдаа хуудсыг дахин дахин ачаалах (loop) болдог тул алдааг энд барьж мессеж харуулна.
const ErrorPage = ({ error, retry }) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-4 py-16 text-center">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-gray-900">Алдаа гарлаа</h1>
        <p className="text-sm text-gray-500">Хуудсыг ачаалахад алдаа гарлаа. Дахин оролдоно уу.</p>
        {error?.digest && <p className="font-mono text-xs text-gray-400">{error.digest}</p>}
      </div>
      <Button variant="primary" onClick={() => retry()}>
        Дахин оролдох
      </Button>
    </div>
  );
};

export default ErrorPage;
