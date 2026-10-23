// Хүсэлт илгээж { ok, status, ...body } буцаана. Амжилтгүй бол errors.form-д
// үргэлж мессеж байна (серверээс errors ирээгүй, сүлжээний алдаа г.м.).
async function send(url, init) {
  let res;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, status: 0, errors: { form: "Сервертэй холбогдож чадсангүй" } };
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok && !body.errors) {
    body.errors = { form: body.error ?? "Алдаа гарлаа, дахин оролдоно уу" };
  }
  return { ok: res.ok, status: res.status, ...body };
}

// JSON хүсэлт
export const sendJson = (url, method = "GET", data) =>
  send(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });

// Файлтай form (multipart/form-data). Content-Type-ийг браузер өөрөө тохируулна.
export const sendForm = (url, method, formData) => send(url, { method, body: formData });
