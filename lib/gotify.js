import got from "got";
import { config } from "./config.js";

const api = {}


export function notifyGotify(textMessage, emailUUID) {
  if (!(emailUUID in api)){
    api[emailUUID] = got.extend({
      prefixUrl: config.get(`${emailUUID}.notifications.gotify.url`),
    });
  }

  api[emailUUID].post(`message?token=${config.get(`${emailUUID}.notifications.gotify.apptoken`)}`, {
    json: {
      title: "TooGoodToGo Watcher",
      message: textMessage,
      priority: config.get(`${emailUUID}.notifications.gotify.priority`),
      extras: {
        "client::notification": {
          click: { url: "https://share.toogoodtogo.com/" },
        },
      },
    },
  }).catch(error => console.log(`Gotify UUID ${emailUUID}: An error occurred when sending post request.\n` + error));
}
