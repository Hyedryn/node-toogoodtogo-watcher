#!/usr/bin/env node
import { hasListeners$, notifyIfChanged } from "./lib/notifier.js";
import { consoleLogin } from "./lib/console-login.js";
import { pollFavoriteBusinesses$ } from "./lib/poller.js";
import { editConfig, resetConfig, configPath, config, defaults } from "./lib/config.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createTelegramBot } from "./lib/telegram-bot.js";

import {v1 as uuidv1} from 'uuid';

const argv = yargs(hideBin(process.argv))
  .usage("Usage: toogoodtogo-watcher <command>")
  .env("TOOGOODTOGO")
  .command("config", "Edit the config file.")
  .command("config-reset", "Reset the config to the default values.")
  .command("config-path", "Show the path of the config file.")
  .command("login", "Interactively login via a login email.", {
    email: {
      type: "string",
      demandOption: true,
      describe:
        "The email address to login with.",
    },
  })
  .command("watch", "Watch your favourite businesses for changes.", {
    config: {
      type: "string",
      describe:
        "Custom config. Note: the config will be overwrite the current config file.",
    },
  })
  .demandCommand().argv;

switch (argv._[0]) {
  case "config":
    editConfig();
    break;

  case "config-reset":
    resetConfig();
    break;

  case "config-path":
    configPath();
    break;

  case "login":
    let emailUUID;
    if (argv.email) {
      let uuidDic = config.get("email");
      let idx = Object.values(uuidDic).indexOf(argv.email);
      if (idx > -1 ) {
        emailUUID = Object.keys(uuidDic)[idx];
      }else{
        emailUUID = uuidv1()
        let mailUUID = config.get('email')
        mailUUID[emailUUID] = argv.email
        config.set(`email`, mailUUID)
        config.set(`${emailUUID}`, defaults["uuid"])
        config.set(`${emailUUID}.api.credentials.email`, argv.email);
      }
    }else{
      console.error("Did not get an email addr. See usage for more details.");
      break;
    }
    await consoleLogin(emailUUID);
    break;

  case "watch":
    if (argv.config) {
      const customConfig = JSON.parse(argv.config);
      config.set(customConfig);
    }


    let dicEmail = config.get("email");

    for (let emailUUID in dicEmail){
      await createTelegramBot(emailUUID);
      pollFavoriteBusinesses$(hasListeners$(emailUUID), emailUUID).subscribe({
        next: (businesses) => notifyIfChanged(businesses, emailUUID),
        error: console.error,
      });
      console.log("DONE");
    }
    break;
}
