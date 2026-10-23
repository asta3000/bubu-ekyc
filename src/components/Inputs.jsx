"use client";


// Input, select зэрэг талбаруудын нийтлэг загвар
export const fieldClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-500";

export const FieldError = ({ error }) =>
  error ? <span className="block text-xs text-red-600">{error}</span> : null;

// Талбарыг шошго, алдааны мессежтэй ороох. Хоёулаа хоосон бол зөвхөн талбар (хайлт г.м.)
export const FieldLabel = ({ label, error, children }) => {
  if (!label && !error) return children;

  return (
    <label className="block space-y-1">
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
      {children}
      <FieldError error={error} />
    </label>
  );
};

export const Input = ({ label, error, type = "text", className = "", ...props }) => (
  <FieldLabel label={label} error={error}>
    <input
      type={type}
      className={`${fieldClass} ${className}`}
      aria-invalid={Boolean(error)}
      {...props}
    />
  </FieldLabel>
);

export const Textarea = ({ label, error, className = "", ...props }) => (
  <FieldLabel label={label} error={error}>
    <textarea className={`${fieldClass} ${className}`} aria-invalid={Boolean(error)} {...props} />
  </FieldLabel>
);

// options: [{ value, label }]. placeholder өгвөл хоосон ("") утгатай эхний сонголт.
export const Select = ({ label, error, options, placeholder, className = "", ...props }) => (
  <FieldLabel label={label} error={error}>
    <select className={`${fieldClass} ${className}`} aria-invalid={Boolean(error)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </FieldLabel>
);

export const Checkbox = ({ label, description, error, className = "", ...props }) => (
  <div className={className}>
    <label className="flex cursor-pointer items-start gap-2 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-60">
      <input type="checkbox" className="mt-0.5 accent-blue-600" {...props} />
      <span>
        {label}
        {description && <span className="block text-xs text-gray-500">{description}</span>}
      </span>
    </label>
    <FieldError error={error} />
  </div>
);

export const PasswordInput = (props) => (
  <Input type="password" autoComplete="new-password" minLength={8} maxLength={72} {...props} />
);

export const SearchInput = (props) => <Input type="search" {...props} />;

// Овог, нэр, холбоо барих. user өгвөл түүний утгаар бөглөнө (админ засвар).
export const ProfileFields = ({ errors, user }) => (
  <>
    <div className="grid grid-cols-2 gap-3">
      <Input
        label="Овог"
        name="lastName"
        defaultValue={user?.lastName}
        autoComplete={user ? "off" : "family-name"}
        error={errors.lastName}
        required
      />
      <Input
        label="Нэр"
        name="firstName"
        defaultValue={user?.firstName}
        autoComplete={user ? "off" : "given-name"}
        error={errors.firstName}
        required
      />
    </div>
    <Input
      label="Холбоо барих"
      name="contact"
      type="tel"
      defaultValue={user?.contact}
      autoComplete={user ? "off" : "tel"}
      maxLength={100}
      error={errors.contact}
      required
    />
  </>
);

// Шинэ нууц үг ба давталт (password, confirmPassword). columns бол хажуу хажуудаа.
export const NewPasswordFields = ({ errors, label = "Шинэ нууц үг", columns = false }) => (
  <div className={columns ? "grid grid-cols-2 gap-3" : "space-y-4"}>
    <PasswordInput label={label} name="password" error={errors.password} required />
    <PasswordInput
      label="Нууц үг давтах"
      name="confirmPassword"
      error={errors.confirmPassword}
      required
    />
  </div>
);
