import got from "got";
import { config } from "./config.js";

const api = {}

export function notifyNtfy(textMessage, emailUUID) {
  if (!(emailUUID in api)){
    api[emailUUID] = got.extend({
      prefixUrl: config.get(`${emailUUID}.notifications.ntfy.url`),
    });
  }

  api[emailUUID].post("", {
    json: {
      topic: `TooGoodToGo-${emailUUID}`,
      title: "TooGoodToGo Watcher",
      message: textMessage,
      priority: config.get(`${emailUUID}.notifications.ntfy.priority`),
      tags: ["maple_leaf"],
      extras: {
        "client::notification": {
          click: { url: "https://share.toogoodtogo.com/" },
        },
      },
    },
  }).catch(error => console.log(`Ntfy UUID ${emailUUID}: An error occurred when sending post request.\n` + error));

}
