import got from "got";
import { config } from "./config.js";

const api = got.extend({
  prefixUrl: "https://maker.ifttt.com/trigger",
});

export function notifyIFTTT(textMessage, htmlMessage, emailUUID) {
  const iftttEvents = config.get(`${emailUUID}.notifications.ifttt.webhookEvents`);
  for (const iftttEvent of iftttEvents) {
    api.post(
      `${iftttEvent}/with/key/${config.get(`${emailUUID}.notifications.ifttt.webhookKey`)}`,
      {
        json: {
          value1: textMessage,
          value2: htmlMessage,
        },
      }
    );
  }
}
