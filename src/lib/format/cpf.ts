// CPF do signatário legal (SIGNATARIO-CONTATO): validação por dígitos verificadores.
export function cpfDigits(v: string): string {
  return v.replace(/\D/g, "").slice(0, 11);
}

export function formatCpf(v: string): string {
  const d = cpfDigits(v);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function isValidCpf(v: string): boolean {
  const d = cpfDigits(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}
