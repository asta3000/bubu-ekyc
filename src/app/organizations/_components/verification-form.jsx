"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/Buttons";
import { Card } from "@/components/Cards";
import { FieldError } from "@/components/Inputs";
import { Message } from "@/components/Messages";
import { withOverageConfirm } from "@/lib/billing/client";
import { sendForm } from "@/lib/fetcher";
import { compressImage } from "@/lib/images";
import {
  DOCUMENT_MAX_SIZE,
  DOCUMENT_TYPES,
  SELFIE_MAX_SIZE,
  SELFIE_TYPES,
  verificationFileError,
} from "@/lib/validations";

// Vercel function-д илгээх хүсэлтийн дээд хэмжээ (4.5MB)-аас бага байлгана
const MAX_REQUEST_SIZE = 4 * 1024 * 1024;

// Зураг сонгох талбар: урьдчилан харах, алдааны мессеж. capture: утсан дээр камер нээнэ.
const ImagePicker = ({ label, hint, accept, capture, file, onChange, error, required }) => {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <label className="block cursor-pointer space-y-2">
      <span className="text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-blue-400">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-contain" />
        ) : file ? (
          <span className="px-3 text-center text-sm text-gray-700">{file.name}</span>
        ) : (
          <span className="px-3 text-center text-sm text-gray-500">{hint}</span>
        )}
      </div>
      <input
        type="file"
        accept={accept}
        capture={capture}
        className="sr-only"
        onChange={(event) => onChange(event.target.files[0] ?? null)}
      />
      <FieldError error={error} />
    </label>
  );
};

const PICKERS = [
  {
    name: "front",
    label: "Баримт бичгийн нүүр тал",
    hint: "Гадаад паспортын зурагтай хуудас эсвэл иргэний үнэмлэхний нүүр тал. Дөрвөн булан нь харагдаж байх.",
    accept: DOCUMENT_TYPES.join(","),
    rules: { types: DOCUMENT_TYPES, maxSize: DOCUMENT_MAX_SIZE, label: "Нүүр тал" },
    required: true,
  },
  {
    name: "back",
    label: "Ар тал",
    hint: "Иргэний үнэмлэхний ар тал (MRZ-тэй). Паспортод шаардлагагүй.",
    accept: DOCUMENT_TYPES.join(","),
    rules: { types: DOCUMENT_TYPES, maxSize: DOCUMENT_MAX_SIZE, label: "Ар тал" },
  },
  {
    name: "selfie",
    label: "Сельфи зураг",
    hint: "Харилцагчийн нүүр тод харагдах, урдаасаа авсан зураг.",
    accept: SELFIE_TYPES.join(","),
    capture: "user",
    rules: { types: SELFIE_TYPES, maxSize: SELFIE_MAX_SIZE, label: "Сельфи" },
    required: true,
  },
];

const VerificationForm = () => {
  const router = useRouter();
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);

  const select = (picker) => (file) => {
    setFiles((current) => ({ ...current, [picker.name]: file }));
    setErrors((current) => ({ ...current, [picker.name]: file && verificationFileError(file, picker.rules) }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const missing = Object.fromEntries(
      PICKERS.filter((picker) => picker.required && !files[picker.name]).map((picker) => [
        picker.name,
        `${picker.label} оруулна уу`,
      ]),
    );
    if (Object.keys(missing).length || Object.values(errors).some(Boolean)) {
      setErrors((current) => ({ ...current, ...missing }));
      return;
    }

    setPending(true);
    const formData = new FormData();
    let total = 0;
    for (const picker of PICKERS) {
      if (!files[picker.name]) continue;
      const file = await compressImage(files[picker.name]);
      total += file.size;
      formData.append(picker.name, file);
    }
    if (total > MAX_REQUEST_SIZE) {
      setErrors({ form: "Файлуудын нийт хэмжээ 4MB-аас их байна. PDF-ийн оронд зураг оруулна уу." });
      setPending(false);
      return;
    }

    const result = await withOverageConfirm((payOverage) => {
      formData.set("payOverage", String(payOverage));
      return sendForm("/api/organizations/verifications", "POST", formData);
    });
    if (result.ok) {
      router.push(`/organizations/verifications/${result.id}`);
      return;
    }
    setErrors(result.errors);
    setPending(false);
  };

  return (
    <Card
      title="Шинэ баталгаажуулалт"
      description="Баримт бичгээс мэдээллийг уншиж, хуурамч эсэхийг шалгаад, баримтын зураг дээрх нүүрийг сельфитэй тулгана."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Message error={errors.form} />
        <div className="grid gap-4 md:grid-cols-3">
          {PICKERS.map((picker) => (
            <ImagePicker
              key={picker.name}
              {...picker}
              file={files[picker.name]}
              onChange={select(picker)}
              error={errors[picker.name]}
            />
          ))}
        </div>
        <div className="flex justify-end">
          <div className="w-48">
            <PrimaryButton pending={pending} pendingText="Шалгаж байна...">
              Шалгах
            </PrimaryButton>
          </div>
        </div>
      </form>
    </Card>
  );
};

export default VerificationForm;
