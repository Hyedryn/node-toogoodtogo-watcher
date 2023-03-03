import notifier from "node-notifier";
import { config } from "./config.js";
import { hasActiveTelegramChats$, notifyTelegram } from "./telegram-bot.js";
import _ from "lodash";
import moment from "moment";
import { combineLatest, of } from "rxjs";
import { notifyGotify } from "./gotify.js";
import { notifyNtfy } from "./ntfy.js";
import { notifyIFTTT } from "./ifttt.js";
import { notifyEmail } from "./email.js";
import { map } from "rxjs/operators";

const cache = {};//{ businessesById: {} };

export function hasListeners$(emailUUID) {
  return combineLatest([
    of(config.get(`${emailUUID}.notifications.console.enabled`)),
    of(config.get(`${emailUUID}.notifications.desktop.enabled`)),
    of(config.get(`${emailUUID}.notifications.ifttt.enabled`)),
    of(config.get(`${emailUUID}.notifications.gotify.enabled`)),
    of(config.get(`${emailUUID}.notifications.email.enabled`)),
    of(config.get(`${emailUUID}.notifications.ntfy.enabled`)),
    hasActiveTelegramChats$(),
  ]).pipe(map((enabledItems) => _.some(enabledItems)));
}

export function notifyIfChanged(businesses, emailUUID) {
  const businessesById = _.keyBy(businesses, "item.item_id");

  if (!(emailUUID in cache)){
    cache[emailUUID] = {businessesById: {} };
  }

  const filteredBusinesses = filterBusinesses(businessesById, emailUUID);

  for (var i = 0; i < filteredBusinesses.length; i++) {
    const textMessage = createTextMessage([filteredBusinesses[i]]);
    const htmlMessage = createHtmlMessage([filteredBusinesses[i]]);
    let storeID = filteredBusinesses[i]["item"]["item_id"];

    if (config.get(`${emailUUID}.notifications.console.enabled`)) {
      notifyConsole(textMessage, config.get(`${emailUUID}.notifications.console`));
    }

    if (config.get(`${emailUUID}.notifications.desktop.enabled`)) {
      notifyDesktop(textMessage, emailUUID);
    }
    if (config.get(`${emailUUID}.notifications.telegram.enabled`)) {
      notifyTelegram(htmlMessage, emailUUID);
    }
    if (config.get(`${emailUUID}.notifications.ifttt.enabled`)) {
      notifyIFTTT(textMessage, htmlMessage, emailUUID);
    }
    if (config.get(`${emailUUID}.notifications.gotify.enabled`)) {
      notifyGotify(textMessage, emailUUID);
    }
    if (config.get(`${emailUUID}.notifications.email.enabled`)) {
      notifyEmail(htmlMessage, emailUUID);
    }
    if (config.get(`${emailUUID}.notifications.ntfy.enabled`)) {
      notifyNtfy(textMessage, emailUUID, storeID);
    }
  }

  cache[emailUUID].businessesById = businessesById;
}

function filterBusinesses(businessesById,emailUUID) {
  return Object.keys(businessesById)
    .filter((key) => {
      const current = businessesById[key];
      const previous = cache[emailUUID].businessesById[key];
      return hasInterestingChange(current, previous, emailUUID);
    })
    .map((key) => businessesById[key]);
}

function hasInterestingChange(current, previous, emailUUID) {
  const options = config.get(`${emailUUID}.messageFilter`);

  const currentStock = current.items_available;
  const previousStock = previous ? previous.items_available : 0;

  if (currentStock === previousStock) {
    return options.showUnchanged;
  } else if (currentStock === 0) {
    return options.showDecreaseToZero;
  } else if (currentStock < previousStock) {
    return options.showDecrease;
  } else if (previousStock === 0) {
    return options.showIncreaseFromZero;
  } else {
    return options.showIncrease;
  }
}

function notifyConsole(message, options) {
  if (options.clear) {
    console.clear();
  }
  console.log("\n" + message + "\n");
}

function notifyDesktop(message,emailUUID) {
  notifier.notify({ title: `TooGoodToGo for user ${emailUUID}:`, message });
}

function createTextMessage(businesses) {
  return businesses
    .map(
      (business) => `${business.display_name}
Price: ${business.item.price_including_taxes.minor_units / 100}
Quantity: ${business.items_available}
Pickup: ${formatInterval(business)}`
    )
    .join("\n\n");
}

function createHtmlMessage(businesses) {
  return businesses
    .map(
      (business) =>
        `<a href="https://share.toogoodtogo.com/item/${
          business.item.item_id
        }">🍽 ${business.display_name}</a>
💰 ${business.item.price_including_taxes.minor_units / 100}
🥡 ${business.items_available}
⏰ ${formatInterval(business)}`
    )
    .join("\n\n");
}

function formatInterval(business) {
  if (!business.pickup_interval) {
    return "?";
  }
  const startDate = formatDate(business.pickup_interval.start);
  const endDate = formatDate(business.pickup_interval.end);
  return `${startDate} - ${endDate}`;
}

function formatDate(dateString) {
  return moment(dateString).calendar(null, {
    lastDay: "[Yesterday] HH:mm",
    sameDay: "[Today] HH:mm",
    nextDay: "[Tomorrow] HH:mm",
    lastWeek: "[Last Week] dddd HH:mm",
    nextWeek: "dddd HH:mm",
    sameElse: "L",
  });
}
