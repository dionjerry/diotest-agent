function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function autoSessionName(domain: string, flow: string, now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mi = pad(now.getMinutes());
  return `${domain} - ${flow} - ${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
