import { DataSource } from "typeorm";
import { PaymentLink } from "../models/PaymentLink";
import { PSPAppsUrl } from "../models/PSPAppsUrl";
import { readFileSync } from "node:fs";
import path from "node:path";
export const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: process.env.DB_NAME || "database.sqlite",
  synchronize: true,
  logging: true,
  entities: [PaymentLink,PSPAppsUrl],
});

export const paymentLinkRepo =  AppDataSource.getRepository(PaymentLink);
export const pspAppsListRepo = AppDataSource.getRepository(PSPAppsUrl);

export async function intitializeDBData(){
  const pspAppData = JSON.parse(readFileSync(path.join(__dirname,"psp-app-data.json"),"utf-8"));
  await pspAppsListRepo.save(pspAppData)
}