import Link from "next/link";
import { BUTTON_VARIANTS } from "./buttonStyles";

export const TextLink = ({ className = "", ...props }) => (
  <Link className={`text-sm text-blue-600 hover:underline ${className}`} {...props} />
);

// Товч хэлбэртэй холбоос. variant нь Button-тай ижил.
export const ButtonLink = ({ variant = "secondary", className = "", ...props }) => (
  <Link className={`inline-block ${BUTTON_VARIANTS[variant]} ${className}`} {...props} />
);
