import { readFileSync } from "fs";
import { resolve } from "path";
import QRCode from "qrcode";

const templatePath = resolve(__dirname, "pay.html");
const template = readFileSync(templatePath, "utf-8");

interface DeeplinkItem {
  name: string;
  url: string;
  logoUrl: string;
  identifier: string;
}

export async function renderPayPage(
  intentURL: string,
  deeplinks: DeeplinkItem[] = [],
  paymentId: string = "",
  expireAt: string = ""
): Promise<string> {
  const qrDataURL = await QRCode.toDataURL(intentURL);

  const deeplinksHtml = deeplinks
    .filter((d) => d.identifier !== "default")
    .map(
      (d) => `
        <a class="app-btn" href="${d.url}">
          ${
            d.logoUrl
              ? `<img src="${d.logoUrl}" alt="${d.name}" />`
              : `<div class="app-icon-placeholder">📱</div>`
          }
          <span>${d.name}</span>
        </a>`
    )
    .join("");

  return template
    .replace("{{qrDataURL}}", qrDataURL)
    .replace(/{{intentURL}}/g, intentURL)
    .replace("{{deeplinks}}", deeplinksHtml)
    .replace("{{paymentId}}", paymentId)
    .replace("{{expireAt}}", expireAt);
}
