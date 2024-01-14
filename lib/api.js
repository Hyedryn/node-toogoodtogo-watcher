import _ from "lodash";
import got from "got";
import { CookieJar } from "tough-cookie";
import { config } from "./config.js";

const api = got.extend({
  cookieJar: new CookieJar(),
  prefixUrl: config.get("api.prefixUrl"),
  headers: _.defaults(config.get("api.headers"), {
    "User-Agent":
      "TooGoodToGo/21.9.0 (813) (iPhone/iPhone 7 (GSM); iOS 15.1; Scale/2.00)",
    "Content-Type": "application/json",
    Accept: "",
    "Accept-Language": "en-US",
    "Accept-Encoding": "gzip",
  }),
  responseType: "json",
  resolveBodyOnly: true,
  retry: {
    limit: 2,
    methods: ["GET", "POST", "PUT", "HEAD", "DELETE", "OPTIONS", "TRACE"],
    statusCodes: [401, 403, 408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
  },
});
export function authByEmail(emailUUID) {
  const credentials = config.get(`${emailUUID}.api.credentials`);

  return api.post("auth/v3/authByEmail", {
    json: {
      device_type: config.get(`${emailUUID}.api.deviceType`, "IOS"),
      email: credentials.email,
    },
  });
}

export function authPoll(polling_id, emailUUID) {
  const credentials = config.get(`${emailUUID}.api.credentials`);
  return api
    .post("auth/v3/authByRequestPollingId", {
      json: {
        device_type: config.get(`${emailUUID}.api.deviceType`, "IOS"),
        email: credentials.email,
        request_polling_id: polling_id,
      },
    })
    .then(login => createSession(login, emailUUID));
}

export function login(emailUUID) {
  const session = getSession(emailUUID);
  if (session.refreshToken) {
    return refreshToken(emailUUID);
  }
  throw `[${emailUUID}]` + " login: You are not logged in. Login via the command `toogoodtogo-watcher login` or `/login` with the Telegram Bot";
}

function refreshToken(emailUUID) {
  const session = getSession(emailUUID);
  console.log("["+ config.get(`${emailUUID}.api.credentials.email`) +"]"+` Refreshing session token...`)
  return api
    .post("auth/v3/token/refresh", {
      json: {
        refresh_token: session.refreshToken,
      },
    })
    .then(token => updateSession(token, emailUUID));
  }

export function listFavoriteBusinesses(emailUUID) {
  console.log("["+ config.get(`${emailUUID}.api.credentials.email`) +"]"+` listFavoriteBusinesses: Retrieving favorite businesses...`)
  const session = getSession(emailUUID);
  return api.post("item/v8/", {
    json: {
      favorites_only: true,
      origin: {
        latitude: config.get(`${emailUUID}.origin.latitude`),
        longitude: config.get(`${emailUUID}.origin.longitude`),
      },
      radius: 200,
      user_id: session.userId,
    },
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });
}

function getSession(emailUUID) {
  return config.get(`${emailUUID}.api.session`) || {};
}

function createSession(login, emailUUID) {
  console.log("["+ config.get(`${emailUUID}.api.credentials.email`) +"]"+` createSession: Retrieved new session token: ${login.access_token}` + " and refresh token: " + login.refresh_token)
  if (login) {
    config.set(`${emailUUID}.api.session`, {
      userId: login.startup_data.user.user_id,
      accessToken: login.access_token,
      refreshToken: login.refresh_token,
    });
  }
  return login;
}

function updateSession(token, emailUUID) {
  console.log("["+ config.get(`${emailUUID}.api.credentials.email`) +"]"+` updateSession: Retrieved new session token: ${token.access_token}, updating session...`)
  config.set(`${emailUUID}.api.session.accessToken`, token.access_token);
  return token;
}
