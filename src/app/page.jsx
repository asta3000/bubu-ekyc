import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ButtonLink } from "@/components/Links";
import { Logo, LogoMark } from "@/components/Logos";
import { SANCTION_SOURCES } from "@/lib/sanctions/sources";
import { getSystemInfo } from "@/lib/system";

// Нэвтрээгүй хэрэглэгчийн нүүр хуудас (вэбсайт). Нэвтэрсэн хэрэглэгчийг proxy
// эрхийнх нь үндсэн хуудас руу шилжүүлдэг тул энд session шалгахгүй.

const NAV = [
  { href: "#features", label: "Үйлчилгээ" },
  { href: "#sources", label: "Жагсаалтууд" },
  { href: "#how", label: "Хэрхэн ажилладаг" },
];

const FEATURES = [
  {
    title: "Хориг шалгах",
    text: "Хувь хүн, хуулийн этгээдийн нэрийг олон улсын хоригийн жагсаалттай тулгана. Галиг, үсгийн алдаа, нэрийн дарааллын зөрүүг ч олно.",
    icon: "M10.5 3.75a6.75 6.75 0 1 0 4.2 12.04l3.75 3.75 1.06-1.06-3.75-3.75A6.75 6.75 0 0 0 10.5 3.75Zm0 1.5a5.25 5.25 0 1 1 0 10.5 5.25 5.25 0 0 1 0-10.5Z",
  },
  {
    title: "Баримт бичиг баталгаажуулах",
    text: "Иргэний үнэмлэх, паспортын зургаас мэдээллийг автоматаар уншиж, хуурамч шинжийг илрүүлнэ. Сельфиг баримтын зурагтай тулгана.",
    icon: "M4.5 5.25A1.5 1.5 0 0 0 3 6.75v10.5a1.5 1.5 0 0 0 1.5 1.5h15a1.5 1.5 0 0 0 1.5-1.5V6.75a1.5 1.5 0 0 0-1.5-1.5h-15Zm0 1.5h15v10.5h-15V6.75Zm4.5 2.25a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5ZM6 16.5c.3-1.3 1.5-2.25 3-2.25s2.7.95 3 2.25H6Zm7.5-6.75h4.5v1.5h-4.5v-1.5Zm0 3h3v1.5h-3v-1.5Z",
  },
  {
    title: "QR баталгаат тайлан",
    text: "Шалгалтын үр дүнг хэвлэх тайлан болгоно. Тайлан дээрх QR кодыг уншуулж хэн ч жинхэнэ эсэхийг шалгах боломжтой.",
    icon: "M3.75 3.75h6v6h-6v-6Zm1.5 1.5v3h3v-3h-3Zm9-1.5h6v6h-6v-6Zm1.5 1.5v3h3v-3h-3Zm-12 9h6v6h-6v-6Zm1.5 1.5v3h3v-3h-3Zm8.25-1.5h1.5v1.5h-1.5v-1.5Zm3 0h1.5v3h-1.5v-3Zm-3 3h1.5v3h-1.5v-3Zm3 1.5h3v1.5h-3v-1.5Z",
  },
  {
    title: "Уян хатан багц",
    text: "Байгууллагын хэмжээнд тохирох багц сонгоно. QPay эсвэл банкны шилжүүлгээр төлж, хэрэглээгээ хэтэвчнээсээ хянана.",
    icon: "M3 6.75A2.25 2.25 0 0 1 5.25 4.5h13.5A2.25 2.25 0 0 1 21 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 17.25V6.75Zm1.5 1.5v9a.75.75 0 0 0 .75.75h13.5a.75.75 0 0 0 .75-.75v-1.5h-3.75a2.25 2.25 0 0 1 0-4.5h3.75v-2.25a.75.75 0 0 0-.75-.75H4.5Zm11.25 4.5a.75.75 0 0 0 0 1.5h3.75v-1.5h-3.75Z",
  },
];

const STEPS = [
  { title: "Бүртгүүлэх", text: "Байгууллагаа бүртгүүлж, имэйлээ баталгаажуулна." },
  { title: "Багц сонгох", text: "Хэрэгцээндээ тохирох багцыг идэвхжүүлнэ." },
  { title: "Шалгах", text: "Харилцагчийн нэр, баримтыг оруулж хэдхэн секундэд үр дүн авна." },
  { title: "Тайлан хадгалах", text: "QR кодтой тайланг хэвлэж, хяналтын бүртгэлдээ хавсаргана." },
];

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
    <path fill="currentColor" fillRule="evenodd" d={d} />
  </svg>
);

const Check = () => (
  <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-teal-500" aria-hidden="true">
    <path fill="currentColor" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" />
  </svg>
);

const SectionTitle = ({ eyebrow, title, text }) => (
  <div className="mx-auto max-w-2xl space-y-3 text-center">
    <p className="text-sm font-semibold tracking-wide text-teal-600 uppercase">{eyebrow}</p>
    <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
    {text && <p className="text-base text-slate-600">{text}</p>}
  </div>
);

const Header = () => (
  <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
    <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
      <Logo className="text-xl" />
      <div className="hidden items-center gap-8 md:flex">
        {NAV.map((item) => (
          <a key={item.href} href={item.href} className="text-sm font-medium text-slate-600 hover:text-slate-900">
            {item.label}
          </a>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Link href="/login" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Нэвтрэх
        </Link>
        <Link
          href="/register"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Бүртгүүлэх
        </Link>
      </div>
    </nav>
  </header>
);

// Hero-гийн баруун талын жишээ үр дүнгийн карт (жинхэнэ өгөгдөл биш)
const PreviewCard = () => (
  <div className="relative mx-auto w-full max-w-md">
    <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-teal-400/30 to-sky-500/20 blur-2xl" />
    <div className="relative space-y-4 rounded-2xl border border-white/10 bg-white p-6 shadow-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Хориг шалгалтын үр дүн</p>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          Илрээгүй
        </span>
      </div>
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <p className="text-slate-500">Шалгасан нэр</p>
        <p className="font-medium text-slate-900">Батбаяр Энхтуяа</p>
      </div>
      <ul className="space-y-2">
        {SANCTION_SOURCES.slice(0, 5).map((source) => (
          <li key={source.key} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">{source.name}</span>
            <Check />
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
        <div className="grid h-10 w-10 grid-cols-3 gap-0.5 rounded bg-slate-900 p-1.5">
          {[1, 0, 1, 0, 1, 1, 1, 1, 0].map((on, index) => (
            <span key={index} className={on ? "bg-white" : ""} />
          ))}
        </div>
        <p className="text-xs text-slate-500">QR кодоор баталгаажих тайлан бэлэн</p>
      </div>
    </div>
  </div>
);

const Hero = () => (
  <section className="relative overflow-hidden bg-slate-950 text-white">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.25),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(14,116,144,0.35),transparent_50%)]" />
    <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2 lg:py-28">
      <div className="space-y-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-medium text-teal-200">
          Санхүүгийн байгууллага, мэргэжлийн үйлчилгээнд
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Харилцагчаа <span className="text-teal-300">хэдхэн секундэд</span> таньж мэд
        </h1>
        <p className="max-w-xl text-lg text-slate-300">
          Иргэний үнэмлэх, царай тулгалтаар харилцагчийг баталгаажуулж, олон улсын хоригийн жагсаалттай
          автоматаар тулгана. Мөнгө угаахтай тэмцэх (AML) шаардлагаа нэг дор хангана.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/register" variant="hero">
            Бүртгүүлэх
          </ButtonLink>
          <a
            href="#features"
            className="rounded-lg border border-white/20 px-5 py-3 text-base font-semibold text-white hover:bg-white/10"
          >
            Дэлгэрэнгүй
          </a>
        </div>
        <dl className="grid max-w-md grid-cols-3 gap-4 pt-4">
          {[
            [SANCTION_SOURCES.length, "хоригийн жагсаалт"],
            ["Өдөр бүр", "жагсаалт шинэчлэгдэнэ"],
            ["QR", "баталгаат тайлан"],
          ].map(([value, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="text-xl font-bold whitespace-nowrap text-white sm:text-2xl">{value}</dd>
              <dd className="text-xs text-slate-400">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
      <PreviewCard />
    </div>
  </section>
);

const Features = () => (
  <section id="features" className="scroll-mt-16 bg-white py-20">
    <div className="mx-auto max-w-6xl space-y-12 px-4">
      <SectionTitle
        eyebrow="Үйлчилгээ"
        title="KYC-д хэрэгтэй бүхэн нэг системд"
        text="Харилцагч таних, хориг шалгах, баримтжуулах ажлыг гараар хийх шаардлагагүй."
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="space-y-3 rounded-2xl border border-slate-200 p-6 transition hover:border-teal-300 hover:shadow-md"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-cyan-700 text-white">
              <Icon d={feature.icon} />
            </span>
            <h3 className="text-base font-semibold text-slate-900">{feature.title}</h3>
            <p className="text-sm leading-relaxed text-slate-600">{feature.text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const Sources = () => (
  <section id="sources" className="scroll-mt-16 bg-slate-50 py-20">
    <div className="mx-auto max-w-6xl space-y-12 px-4">
      <SectionTitle
        eyebrow="Хоригийн жагсаалтууд"
        title="Албан ёсны эх сурвалжаас шууд"
        text="Жагсаалтуудыг албан ёсны эх сурвалжаас тогтмол татаж шинэчилдэг тул үр дүн тань үргэлж хамгийн сүүлийн мэдээлэлд тулгуурлана."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SANCTION_SOURCES.map((source) => (
          <a
            key={source.key}
            href={source.infoUrl}
            target="_blank"
            rel="noreferrer"
            className="group space-y-2 rounded-xl border border-slate-200 bg-white p-5 hover:border-teal-300"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900">{source.name}</h3>
              <span className="text-slate-300 group-hover:text-teal-500" aria-hidden="true">
                ↗
              </span>
            </div>
            <p className="text-sm text-slate-600">{source.description}</p>
          </a>
        ))}
      </div>
    </div>
  </section>
);

const How = () => (
  <section id="how" className="scroll-mt-16 bg-white py-20">
    <div className="mx-auto max-w-6xl space-y-12 px-4">
      <SectionTitle eyebrow="Хэрхэн ажилладаг" title="Дөрвөн алхамд эхэлнэ" />
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="relative space-y-2 rounded-2xl bg-slate-50 p-6">
            <span className="text-4xl font-bold text-teal-500/30">{String(index + 1).padStart(2, "0")}</span>
            <h3 className="font-semibold text-slate-900">{step.title}</h3>
            <p className="text-sm text-slate-600">{step.text}</p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

const CONTACT_ICONS = {
  phone:
    "M2.25 6.75c0 8.28 6.72 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.37c0-.52-.35-.97-.85-1.09l-4.42-1.1a1.13 1.13 0 0 0-1.17.42l-.97 1.29a1.13 1.13 0 0 1-1.21.38 12.04 12.04 0 0 1-7.14-7.14 1.13 1.13 0 0 1 .38-1.21l1.29-.97c.36-.27.53-.73.42-1.17l-1.1-4.42a1.13 1.13 0 0 0-1.09-.85H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z",
  email:
    "M3 6.75A2.25 2.25 0 0 1 5.25 4.5h13.5A2.25 2.25 0 0 1 21 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 17.25V6.75Zm1.65-.35 7.35 5.15 7.35-5.15a.75.75 0 0 0-.6-.4H5.25a.75.75 0 0 0-.6.4ZM19.5 8.2l-7.07 4.95a.75.75 0 0 1-.86 0L4.5 8.2v9.05c0 .41.34.75.75.75h13.5c.41 0 .75-.34.75-.75V8.2Z",
  address:
    "M12 2.25a7.5 7.5 0 0 0-7.5 7.5c0 5.25 7.5 12 7.5 12s7.5-6.75 7.5-12a7.5 7.5 0 0 0-7.5-7.5Zm0 4.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z",
  website:
    "M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5Zm-1.2 1.6C9.6 5.4 8.85 7.6 8.67 11.25H3.79a8.26 8.26 0 0 1 7-7.4Zm2.4 0a8.26 8.26 0 0 1 7.01 7.4h-4.88c-.18-3.65-.93-5.85-2.13-7.4Zm-1.2.6c1.05 1.35 1.65 3.6 1.83 6.8h-3.66c.18-3.2.78-5.45 1.83-6.8Zm-8.21 8.3h4.88c.18 3.65.93 5.85 2.13 7.4a8.26 8.26 0 0 1-7.01-7.4Zm6.38 0h3.66c-.18 3.2-.78 5.45-1.83 6.8-1.05-1.35-1.65-3.6-1.83-6.8Zm5.16 0h4.88a8.26 8.26 0 0 1-7.01 7.4c1.2-1.55 1.95-3.75 2.13-7.4Z",
};

// Сошиал хуудсуудын лого (20x20 viewBox, нэг өнгө)
const SOCIALS = [
  {
    key: "facebook",
    label: "Facebook",
    icon: "M20 10a10 10 0 1 0-11.56 9.88v-6.99H5.9V10h2.54V7.8c0-2.5 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V10h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 20 10Z",
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: "M10 1.8c2.67 0 2.99 0 4.04.06 2.71.12 3.98 1.41 4.1 4.1.05 1.05.06 1.37.06 4.04s0 2.99-.06 4.04c-.12 2.69-1.39 3.98-4.1 4.1-1.05.05-1.37.06-4.04.06s-2.99 0-4.04-.06c-2.72-.12-3.98-1.42-4.1-4.1C1.81 12.99 1.8 12.67 1.8 10s0-2.99.06-4.04c.12-2.69 1.39-3.98 4.1-4.1C7.01 1.81 7.33 1.8 10 1.8ZM10 0C7.28 0 6.94 0 5.88.06 2.25.23.23 2.24.06 5.88 0 6.94 0 7.28 0 10s0 3.06.06 4.12c.17 3.63 2.18 5.65 5.82 5.82C6.94 20 7.28 20 10 20s3.06 0 4.12-.06c3.63-.17 5.65-2.18 5.82-5.82.06-1.06.06-1.4.06-4.12s0-3.06-.06-4.12C19.77 2.25 17.76.23 14.12.06 13.06 0 12.72 0 10 0Zm0 4.86a5.14 5.14 0 1 0 0 10.28 5.14 5.14 0 0 0 0-10.28Zm0 8.47a3.33 3.33 0 1 1 0-6.66 3.33 3.33 0 0 1 0 6.66Zm5.34-9.87a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: "M18.52 0H1.48C.66 0 0 .65 0 1.45v17.1C0 19.35.66 20 1.48 20h17.04c.82 0 1.48-.65 1.48-1.45V1.45C20 .65 19.34 0 18.52 0ZM5.93 17.04H2.96V7.5h2.97v9.54ZM4.45 6.19a1.72 1.72 0 1 1 0-3.44 1.72 1.72 0 0 1 0 3.44Zm12.59 10.85h-2.96v-4.64c0-1.1-.02-2.53-1.54-2.53-1.55 0-1.78 1.2-1.78 2.45v4.72H7.8V7.5h2.84v1.3h.04a3.12 3.12 0 0 1 2.81-1.54c3 0 3.56 1.98 3.56 4.55v5.23Z",
  },
];

// Админы "Тохиргоо" хэсгийн холбоо барих мэдээлэл. Request бүрт уншдаг тул хадгалмагц шууд харагдана.
// Бөглөөгүй талбарыг харуулахгүй, бүгд хоосон бол хэсэг өөрөө гарахгүй.
const ContactContent = async () => {
  await connection();
  const info = await getSystemInfo();
  const items = [
    { key: "phone", label: "Утас", value: info.phone, href: `tel:${info.phone.replace(/\s/g, "")}` },
    { key: "email", label: "И-мэйл", value: info.email, href: `mailto:${info.email}` },
    { key: "address", label: "Хаяг", value: info.address },
    { key: "website", label: "Вэбсайт", value: info.website.replace(/^https?:\/\//, "").replace(/\/$/, ""), href: info.website },
  ].filter((item) => item.value);
  const socials = SOCIALS.filter((social) => info[social.key]);

  if (!items.length && !socials.length) return null;

  return (
    <section id="contact" className="scroll-mt-16 bg-slate-50 py-20">
      <div className="mx-auto max-w-6xl space-y-12 px-4">
        <SectionTitle eyebrow="Холбоо барих" title="Бидэнтэй холбогдох" text={info.purpose} />
        {items.length > 0 && (
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
            {items.map((item) => {
              const content = (
                <>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <Icon d={CONTACT_ICONS[item.key]} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-500">{item.label}</span>
                    <span className="block font-medium break-words text-slate-900">{item.value}</span>
                  </span>
                </>
              );
              const className = "flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5";
              return item.href ? (
                <a
                  key={item.key}
                  href={item.href}
                  className={`${className} hover:border-teal-300`}
                  {...(item.key === "website" && { target: "_blank", rel: "noreferrer" })}
                >
                  {content}
                </a>
              ) : (
                <div key={item.key} className={className}>
                  {content}
                </div>
              );
            })}
          </div>
        )}
        {socials.length > 0 && (
          <div className="flex justify-center gap-3">
            {socials.map((social) => (
              <a
                key={social.key}
                href={info[social.key]}
                target="_blank"
                rel="noreferrer"
                aria-label={social.label}
                title={social.label}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-teal-300 hover:text-teal-600"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
                  <path fill="currentColor" d={social.icon} />
                </svg>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

const Contact = () => (
  <Suspense fallback={null}>
    <ContactContent />
  </Suspense>
);

const Cta = () => (
  <section className="bg-white px-4 pb-20">
    <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-900 via-slate-900 to-slate-950 px-6 py-14 text-center text-white sm:px-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(45,212,191,0.3),transparent_45%)]" />
      <div className="relative mx-auto max-w-2xl space-y-6">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Өнөөдөр эхлүүлэх үү?</h2>
        <p className="text-slate-300">
          Байгууллагаа бүртгүүлээд харилцагчаа найдвартай, хурдан, баримтжуулсан байдлаар шалгаарай.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href="/register" variant="hero">
            Бүртгүүлэх
          </ButtonLink>
          <Link
            href="/login"
            className="rounded-lg border border-white/20 px-5 py-3 text-base font-semibold text-white hover:bg-white/10"
          >
            Нэвтрэх
          </Link>
        </div>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="border-t border-slate-200 bg-white">
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <LogoMark className="h-6 w-6" />
        <span>© e-KYC. Бүх эрх хуулиар хамгаалагдсан.</span>
      </div>
      <div className="flex gap-6 text-sm text-slate-500">
        {NAV.map((item) => (
          <a key={item.href} href={item.href} className="hover:text-slate-900">
            {item.label}
          </a>
        ))}
      </div>
    </div>
  </footer>
);

const Home = () => (
  <div className="flex flex-1 flex-col">
    <Header />
    <main className="flex-1">
      <Hero />
      <Features />
      <Sources />
      <How />
      <Contact />
      <Cta />
    </main>
    <Footer />
  </div>
);

export default Home;
