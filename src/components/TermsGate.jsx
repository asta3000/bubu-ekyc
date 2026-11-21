"use client";

import { useEffect, useState } from "react";
import { useSubmit } from "@/lib/use-submit";
import { Button, PrimaryButton } from "./Buttons";
import { Checkbox } from "./Inputs";
import { Markdown } from "./Markdown";
import { Message } from "./Messages";
import { Modal } from "./Modals";

// Нэвтрэх бүрт нэг удаа харуулна: хаасныг sessionStorage-д тэмдэглэж, гарахад (Bars-ийн logout) арилгана.
export const TERMS_SEEN_PREFIX = "verdecx-terms-seen:";

const storage = {
  get: (key) => {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key) => {
    try {
      window.sessionStorage.setItem(key, "1");
    } catch {}
  },
};

export const clearTermsSeen = () => {
  try {
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith(TERMS_SEEN_PREFIX))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {}
};

// prompt: { mode: "view" | "accept", version, markdown } (src/lib/terms.js)
export const TermsGate = ({ userId, prompt }) => {
  const key = `${TERMS_SEEN_PREFIX}${userId}:${prompt.version}:${prompt.mode}`;
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const { errors, pending, submit } = useSubmit();

  useEffect(() => {
    if (!storage.get(key)) setOpen(true);
  }, [key]);

  const close = () => {
    storage.set(key);
    setOpen(false);
  };

  const accept = async (event) => {
    event.preventDefault();
    if (await submit("/api/profile/terms", "POST", { version: prompt.version })) setOpen(false);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Үйлчилгээний нөхцөл"
      description={
        prompt.mode === "accept"
          ? "Үйлчилгээг үргэлжлүүлэн ашиглахын өмнө нөхцөлтэй танилцаж зөвшөөрнө үү."
          : "Системийг ашиглахын өмнө үйлчилгээний нөхцөлтэй танилцана уу."
      }
      className="max-w-3xl"
    >
      <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-gray-200 p-4">
        <Markdown source={prompt.markdown} />
      </div>
      {prompt.mode === "accept" ? (
        <form onSubmit={accept} className="space-y-3">
          <Message error={errors.form ?? errors.version} />
          <Checkbox
            label={
              <>
                Үйлчилгээний нөхцөл болон{" "}
                <a href="/privacy" target="_blank" className="text-blue-600 underline">
                  Нууцлал ба мэдээллийн аюулгүй байдлын бодлоготой
                </a>{" "}
                танилцаж, зөвшөөрч байна
              </>
            }
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
          />
          <div className="flex justify-end gap-2">
            <Button onClick={close}>Дараа унших</Button>
            <PrimaryButton pending={pending} disabled={!agreed || pending} className="w-auto">
              Зөвшөөрөх
            </PrimaryButton>
          </div>
        </form>
      ) : (
        <div className="flex justify-end">
          <Button variant="primary" onClick={close}>
            Танилцлаа
          </Button>
        </div>
      )}
    </Modal>
  );
};
