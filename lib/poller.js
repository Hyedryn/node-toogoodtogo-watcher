import _ from "lodash";
import { combineLatest, from, of, timer } from "rxjs";
import { catchError, filter, map, mergeMap, retry } from "rxjs/operators";
import { config } from "./config.js";
import { login, listFavoriteBusinesses } from "./api.js";

const MINIMAL_POLLING_INTERVAL = 15000;
const MINIMAL_AUTHENTICATION_INTERVAL = 3600000;

export function pollFavoriteBusinesses$(enabled$, emailUUID) {
  const authenticationByInterval$ = authenticateByInterval$(emailUUID);
  console.log("["+ config.get(`${emailUUID}.api.credentials.email`) +"]"+` Starting polling for new items...`)
  return listFavoriteBusinessesByInterval$(authenticationByInterval$, enabled$, emailUUID);
}

function authenticateByInterval$(emailUUID) {
  const authenticationIntervalInMs = getInterval(
      `${emailUUID}.api.authenticationIntervalInMS`,
    MINIMAL_AUTHENTICATION_INTERVAL
  );
  console.log("["+ config.get(`${emailUUID}.api.credentials.email`) +"]"+` Refreshing session token every ${authenticationIntervalInMs}ms...`);
  return timer(0, authenticationIntervalInMs).pipe(
    mergeMap(() =>
      from(login(emailUUID)).pipe(
        retry(2),
        catchError(logError),
        filter((authentication) => !!authentication)
      )
    )
  );
}

function listFavoriteBusinessesByInterval$(
  authenticationByInterval$,
  enabled$,
  emailUUID
) {
  const pollingIntervalInMs = getInterval(
      `${emailUUID}.api.pollingIntervalInMs`,
    MINIMAL_POLLING_INTERVAL
  );


  console.log("["+ config.get(`${emailUUID}.api.credentials.email`) +"]"+` Polling for new items every ${pollingIntervalInMs}ms...`);
  console.log("["+ config.get(`${emailUUID}.api.credentials.email`) +"]"+` Enabled: ${enabled$}`);
  return combineLatest([
    enabled$,
    timer(0, pollingIntervalInMs),
    authenticationByInterval$,
  ]).pipe(
    filter(([enabled]) => enabled),
    mergeMap(() =>
      from(listFavoriteBusinesses(emailUUID)).pipe(
        retry(2),
        catchError(logError),
        filter((response) => !!_.get(response, "items")),
        map((response) => response.items)
      )
    )
  );
}

function logError(error) {
  console.log(`Error during request: ${error.message}`)
  if (error.options) {
    console.error(`Error during request:
${error.options.method} ${error.options.url.toString()}
${JSON.stringify(error.options.json, null, 4)}

${error.stack}`);
  } else if (error.stack) {
    console.error(error.stack);
  } else {
    console.error(error);
  }
  return of(null);
}

function getInterval(configPath, minimumIntervalInMs) {
  const configuredIntervalInMs = config.get(configPath);
  return _.isFinite(configuredIntervalInMs)
    ? Math.max(configuredIntervalInMs, minimumIntervalInMs)
    : minimumIntervalInMs;
}
