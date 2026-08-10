import { readFileSync } from "fs";
import { resolve } from "path";

const templatePath = resolve(__dirname, "create.html");
const template = readFileSync(templatePath, "utf-8");

export function renderCreatePage(): string {
  return template;
}
