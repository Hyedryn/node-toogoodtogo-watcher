import _ from "lodash";
import { Telegraf } from "telegraf";
import { config } from "./config.js";
import { authByEmail, authPoll } from "./api.js";
import { BehaviorSubject } from "rxjs";
import { distinctUntilChanged, map } from "rxjs/operators";

const numberOfActiveChats$ = new BehaviorSubject(getNumberOfActiveChats());
const cache = {};
let bot = {};
const botCommands = [
  {
    command: "show_unchanged",
    description: "Activate alert for unchanged stock.",
  },
  {
    command: "show_decrease",
    description: "Activate alert for decreasing stock.",
  },
  {
    command: "show_decrease_to_zero",
    description: "Activate alert for sold out.",
  },
  {
    command: "show_increase",
    description: "Activate alert for increasing stock.",
  },
  {
    command: "show_increase_from_zero",
    description: "Activate alert for new market available.",
  },
  {
    command: "start",
    description: "Activate bot.",
  },
  {
    command: "login",
    description: "Interactively login to your TooGoodToGo account.",
  },
  {
    command: "login_continue",
    description: "Continue login process after clicking the link.",
  },
  {
    command: "stop",
    description: "Deactivate bot.",
  },
  {
    command: "config",
    description: "Show current configuration.",
  },
];

export function hasActiveTelegramChats$() {
  return numberOfActiveChats$.pipe(
    map((numberOfActiveChats) => numberOfActiveChats > 0 && isEnabled()),
    distinctUntilChanged()
  );
}

export function notifyTelegram(message,emailUUID) {
  cache.message = message;

  const chats = getChats(emailUUID);
  _.forEach(chats, (chat) => sendMessage(chat.id, message,emailUUID));
}

function sendMessage(chatId, message, emailUUID) {
  return bot[emailUUID].telegram
    .sendMessage(chatId, message, {
      parse_mode: "html",
      disable_web_page_preview: true,
    })
    .catch((error) => {
      if (error.code === 403) {
        removeChat(chatId);
      } else {
        console.error(`${error.code} - ${error.description}`);
      }
    });
}

export async function createTelegramBot(emailUUID) {
  const botToken = getBotToken(emailUUID);
  if (!isEnabled(emailUUID) || !botToken) {
    return null;
  }
  bot[emailUUID] = new Telegraf(botToken);
  bot.command("start", startCommand(emailUUID));
  bot.command("login", loginCommand(emailUUID));
  bot.command("login_continue", loginContinueCommand);
  bot.command("stop", stopCommand);
  bot.command("config", configCommand);
  bot.command("show_unchanged", showUnchangedCommand(emailUUID));
  bot.command("show_decrease", showDecreaseCommand(emailUUID));
  bot.command("show_decrease_to_zero", showDecreaseToZeroCommand(emailUUID));
  bot.command("show_increase", showIncreaseCommand(emailUUID));
  bot.command("show_increase_from_zero", showIncreaseFromZeroCommand(emailUUID));
  await bot.launch();
  return bot;
}

function startCommand(context,emailUUID) {
  addChat(context,emailUUID);
  context.telegram.setMyCommands(botCommands);
  context
    .reply(
      `👋 I am the TooGoodToGo bot.
🚨 I will tell you whenever the stock of your favorites changes.
To login into your TooGoodToGo account run:
/login
Or with a new email address:
/login email@example.com

If you get tired of my spamming you can (temporarily) disable me with:
/stop`
    )
    .then(() => {
      if (cache.message) {
        return sendMessage(context.chat.id, cache.message, emailUUID);
      }
    });
}

async function loginCommand(context) {
  const textParts = context.update.message.text.split(" ");
  const email = textParts.length > 1 ? textParts[1].trim() : null;
  if (email) {
    config.set(`${email}.api.credentials.email`, email);
    context.reply(`Will start the login process with the specified email address: ${email}.
Open the login email on your PC and click the link.
Don't open the email on a phone that has the TooGoodToGo app installed. That won't work.
When you clicked the link run:
/login_continue
`);
  } else {
    context.reply(
      `Please use a valid email address.`
    );
    return
  }

  try {
    const authResponse = await authByEmail(email);
    cache.loginPollingId = authResponse.polling_id;
    if (!authResponse.polling_id) {
      context.reply("Did not get a polling_id");
    }
  } catch (error) {
    context.reply(
      "Something went wrong\n" + JSON.stringify(error.stack, null, 4)
    );
  }
}

async function loginContinueCommand(context, emailUUID) {
  const authPollingResponse = await authPoll(cache.loginPollingId, emailUUID);
  if (!authPollingResponse) {
    context.reply("Did not get an access token");
    return;
  }

  context.reply("You are now successfully logged in!");
}

function stopCommand(context, emailUUID) {
  context.reply(`😐 Ok.. I get it. Too much is too much. I'll stop bothering you now. 🤫.
You can enable me again with:
/start`);
  removeChat(context.chat.id, emailUUID);
}

function configCommand(context, emailUUID) {
  const config = getConfig(emailUUID);
  context.reply(`🔧 Of course !
Enabled : ${config.bot ? "✅" : "🚫"}
Activate alert for unchanged stock : ${
    config.messageFilter.showUnchanged ? "✅" : "🚫"
  }
Activate alert for decreasing stock : ${
    config.messageFilter.showDecrease ? "✅" : "🚫"
  }
Activate alert for sold out : ${
    config.messageFilter.showDecreaseToZero ? "✅" : "🚫"
  }
Activate alert for increasing stock : ${
    config.messageFilter.showIncrease ? "✅" : "🚫"
  }
Activate alert for new market available : ${
    config.messageFilter.showIncreaseFromZero ? "✅" : "🚫"
  }
  `);
}

function showUnchangedCommand(context,emailUUID) {
  const activate = setOption(`${emailUUID}.showUnchanged`);
  context.reply(
    (activate ? "✅" : "❌") +
      " Unchanged stock will" +
      (activate ? " " : " not ") +
      "be sent."
  );
}

function showDecreaseCommand(context,emailUUID) {
  const activate = setOption(`${emailUUID}.showDecrease`);
  context.reply(
    (activate ? "✅" : "❌") +
      " Decreasing stock will" +
      (activate ? " " : " not ") +
      "be sent."
  );
}

function showDecreaseToZeroCommand(context,emailUUID) {
  const activate = setOption(`${emailUUID}.showDecreaseToZero`);
  context.reply(
    (activate ? "✅" : "❌") +
      " Sold out will" +
      (activate ? " " : " not ") +
      "be sent."
  );
}

function showIncreaseCommand(context,emailUUID) {
  const activate = setOption(`${emailUUID}.showIncrease`);
  context.reply(
    (activate ? "✅" : "❌") +
      " Increasing stock will" +
      (activate ? " " : " not ") +
      "be sent."
  );
}

function showIncreaseFromZeroCommand(context,emailUUID) {
  const activate = setOption(`${emailUUID}.showIncreaseFromZero`);
  context.reply(
    (activate ? "✅" : "❌") +
      " New market available will" +
      (activate ? " " : " not ") +
      "be sent."
  );
}

function addChat(context,emailUUID) {
  const chats = getChats(emailUUID);
  const chat = {
    id: context.chat.id,
    firstName: context.from.first_name,
    lastName: context.from.last_name,
  };
  config.set(
      `${emailUUID}.notifications.telegram.chats`,
    _.unionBy(chats, [chat], (chat) => chat.id)
  );
  console.log(`Added chat ${chat.firstName} ${chat.lastName} (${chat.id})`);
  emitNumberOfActiveChats(emailUUID);
}

function removeChat(chatId, emailUUID) {
  const chats = getChats(emailUUID);
  const chat = _.find(chats, { id: chatId });
  if (chat) {
    config.set(`${emailUUID}.notifications.telegram.chats`, _.pull(chats, chat));
    console.log(`Removed chat ${chat.firstName} ${chat.lastName} (${chat.id})`);
  }
  emitNumberOfActiveChats(emailUUID);
}

function setOption(option, emailUUID) {
  const activate = config.get(`${emailUUID}.messageFilter.` + option);
  config.set("messageFilter." + option, !activate);
  return !activate;
}

function getConfig(emailUUID) {
  const messageFilter = config.get(`${emailUUID}.messageFilter`);
  const bot = config.get(`${emailUUID}.notifications.telegram.enabled`);
  return { messageFilter, bot };
}

function emitNumberOfActiveChats(emailUUID) {
  numberOfActiveChats$.next(getNumberOfActiveChats(emailUUID));
}

function isEnabled(emailUUID) {
  return !!config.get(`${emailUUID}.notifications.telegram.enabled`);
}

function getChats(emailUUID) {
  return config.get(`${emailUUID}.notifications.telegram.chats`);
}

function getBotToken(emailUUID) {
  return config.get(`${emailUUID}.notifications.telegram.botToken`);
}

function getNumberOfActiveChats(emailUUID) {
  const chats = config.get(`${emailUUID}.notifications.telegram.chats`);
  return _.size(chats);
}
