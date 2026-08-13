/**
 * Check if an IP address matches a given entry.
 * Entry can be a plain IP (e.g. "192.168.1.10") or CIDR notation (e.g. "10.0.0.0/8", "0.0.0.0/0").
 */
function ipToLong(ip: string): number {
  const parts = ip.split(".");
  return (
    ((parseInt(parts[0]!, 10) << 24) |
      (parseInt(parts[1]!, 10) << 16) |
      (parseInt(parts[2]!, 10) << 8) |
      parseInt(parts[3]!, 10)) >>>
    0
  );
}

function matchesCIDR(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split("/");
  if (!network || !prefixStr) return false;

  const prefix = parseInt(prefixStr, 10);
  if (prefix < 0 || prefix > 32) return false;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const ipLong = ipToLong(ip);
  const networkLong = ipToLong(network);

  return (ipLong & mask) === (networkLong & mask);
}

export function isIPAllowed(clientIP: string, allowedList: string[]): boolean {
  for (const entry of allowedList) {
    if (entry.includes("/")) {
      // CIDR notation
      if (matchesCIDR(clientIP, entry)) return true;
    } else {
      // Exact match
      if (clientIP === entry) return true;
    }
  }
  return false;
}
