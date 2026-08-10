import { In } from "typeorm";
import { pspAppsListRepo } from "../config/database";

export async function generateDeeplinks(
  intentUrl: string,
  pspAppsList: string[]
) {
  const pspAppData = await pspAppsListRepo.find({
    where: {
      identifier: In(pspAppsList),
    },
  });
  const deeplinks = pspAppData.map((pspApp) => {
    const deeplink = intentUrl.replace("upi://", pspApp.url);
    return {
      ...pspApp,
      url: deeplink,
    };
  });
  return deeplinks;
}