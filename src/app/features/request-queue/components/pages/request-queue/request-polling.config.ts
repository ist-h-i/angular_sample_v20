export const REQUEST_POLLING_CONFIG = {
  requestPollingIntervalMs: 1000, // base polling interval
  requestPollingMinMs: 1000, // don't go lower than this
  requestPollingMaxMs: 60000, // cap growth
  pollingMultiplier: 1.2, // multiplier applied after each successful poll
  pollingMaxConsecutiveErrorsBeforeStop: 5, // stop after too many errors
};
