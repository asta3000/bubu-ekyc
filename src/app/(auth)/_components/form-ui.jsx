import { TextLink } from "@/components/Links";
import { PageTitle } from "@/components/Titles";

export const Divider = () => (
  <div className="flex items-center gap-3 text-xs text-gray-400">
    <span className="h-px flex-1 bg-gray-200" />
    эсвэл
    <span className="h-px flex-1 bg-gray-200" />
  </div>
);

export const StepHeader = ({ title, step, total }) => (
  <div className="space-y-2">
    <div className="flex items-baseline justify-between">
      <PageTitle title={title} />
      <span className="text-xs text-gray-500">
        Алхам {step}/{total}
      </span>
    </div>
    <div className="flex gap-1">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`h-1 flex-1 rounded-full ${index < step ? "bg-blue-600" : "bg-gray-200"}`}
        />
      ))}
    </div>
  </div>
);

// Формын доод талын "Бүртгэлгүй юу? Бүртгүүлэх" г.м. холбоос
export const FormFooter = ({ text, href, children }) => (
  <p className="text-center text-sm text-gray-600">
    {text && `${text} `}
    <TextLink href={href}>{children}</TextLink>
  </p>
);
