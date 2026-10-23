// Багцын тоо дууссан (QUOTA_EXHAUSTED) үед мэдэгдэл харуулж, хэрэглэгч зөвшөөрвөл
// задгай үнээр (хэтэвчнээс) дахин илгээнэ. send(payOverage) нь fetcher-ийн хариуг буцаана.
export async function withOverageConfirm(send) {
  const result = await send(false);
  if (result.code !== "QUOTA_EXHAUSTED") return result;
  if (!window.confirm(`${result.error}\n\nЗадгай үнээр ашиглах уу?`)) return result;
  return send(true);
}
