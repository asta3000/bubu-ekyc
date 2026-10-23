"use client";

import { useEffect, useRef } from "react";

// Native <dialog> дээр суурилсан modal: Escape, focus барих зэргийг браузер хариуцна.
// children нь зөвхөн нээлттэй үед render хийгдэх тул form бүр шинээр эхэлнэ.
export const Modal = ({ open, onClose, title, description, children, className = "max-w-lg" }) => {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Арын бүдэг хэсэг дээр дарахад хаана
      onClick={(event) => event.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] rounded-xl bg-white p-0 shadow-xl backdrop:bg-gray-900/40 ${className}`}
    >
      {open && (
        <div className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              {description && <p className="text-sm text-gray-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Хаах"
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
                <path fill="currentColor" d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
};
