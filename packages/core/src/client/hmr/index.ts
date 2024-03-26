/**
 * This has been adapted from `create-react-app`, authored by Facebook, Inc.
 * see: https://github.com/facebookincubator/create-react-app/tree/master/packages/react-dev-utils
 *
 * Tips: this package will be bundled and running in the browser, do not import from the entry of @rsbuild/core.
 */
import type { StatsError } from '@rsbuild/shared';
import { formatStatsMessages } from '../formatStats';
import { createSocketUrl, parseParams } from './createSocketUrl';
import { ErrorOverlay, overlayId } from './overlay';

const options = parseParams(__resourceQuery);

// Connect to Dev Server
const socketUrl = createSocketUrl(options);

const enableOverlay = options.overlay === 'true';

// Remember some state related to hot module replacement.
let isFirstCompilation = true;
let mostRecentCompilationHash: string | null = null;
let hasCompileErrors = false;

function createErrorOverlay(err: any) {
  clearErrorOverlay();
  document.body.appendChild(new ErrorOverlay(err));
}

function clearErrorOverlay() {
  // use NodeList's forEach api instead of dom.iterable
  // biome-ignore lint/complexity/noForEach: <explanation>
  document.querySelectorAll<ErrorOverlay>(overlayId).forEach((n) => n.close());
}

function clearOutdatedErrors() {
  // Clean up outdated compile errors, if any.
  if (typeof console !== 'undefined' && typeof console.clear === 'function') {
    if (hasCompileErrors) {
      console.clear();
    }
  }
}

// Successful compilation.
function handleSuccess() {
  clearOutdatedErrors();

  const isHotUpdate = !isFirstCompilation;
  isFirstCompilation = false;
  hasCompileErrors = false;

  // Attempt to apply hot updates or reload.
  if (isHotUpdate) {
    tryApplyUpdates();
  }
}

// Compilation with warnings (e.g. ESLint).
function handleWarnings(warnings: StatsError[]) {
  clearOutdatedErrors();

  const isHotUpdate = !isFirstCompilation;
  isFirstCompilation = false;
  hasCompileErrors = false;

  function printWarnings() {
    // Print warnings to the console.
    const formatted = formatStatsMessages({
      warnings,
      errors: [],
    });

    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      for (let i = 0; i < formatted.warnings.length; i++) {
        if (i === 5) {
          console.warn(
            'There were more warnings in other files.\n' +
              'You can find a complete log in the terminal.',
          );
          break;
        }
        console.warn(formatted.warnings[i]);
      }
    }
  }

  printWarnings();

  // Attempt to apply hot updates or reload.
  if (isHotUpdate) {
    tryApplyUpdates();
  }
}

// Compilation with errors (e.g. syntax error or missing modules).
function handleErrors(errors: StatsError[]) {
  clearOutdatedErrors();

  isFirstCompilation = false;
  hasCompileErrors = true;

  // "Massage" webpack messages.
  const formatted = formatStatsMessages({
    errors,
    warnings: [],
  });

  // Also log them to the console.
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    for (const error of formatted.errors) {
      console.error(error);
    }
  }

  if (enableOverlay) {
    createErrorOverlay(formatted.errors);
  }

  // Do not attempt to reload now.
  // We will reload on next success instead.
}

// There is a newer version of the code available.
function handleAvailableHash(hash: string) {
  // Update last known compilation hash.
  mostRecentCompilationHash = hash;
}

function isUpdateAvailable() {
  // __webpack_hash__ is the hash of the current compilation.
  // It's a global variable injected by webpack / Rspack.
  return mostRecentCompilationHash !== __webpack_hash__;
}

// webpack disallows updates in other states.
function canApplyUpdates() {
  return import.meta.webpackHot.status() === 'idle';
}

// Attempt to update code on the fly, fall back to a hard reload.
function tryApplyUpdates() {
  // detect is there a newer version of this code available
  if (!isUpdateAvailable()) {
    return;
  }

  if (!import.meta.webpackHot) {
    // HotModuleReplacementPlugin is not in Rspack configuration.
    window.location.reload();
    return;
  }

  if (!canApplyUpdates()) {
    return;
  }

  function handleApplyUpdates(
    err: unknown,
    updatedModules: (string | number)[] | null,
  ) {
    const wantsForcedReload = err || !updatedModules;
    if (wantsForcedReload) {
      window.location.reload();
      return;
    }

    if (isUpdateAvailable()) {
      // While we were updating, there was a new update! Do it again.
      tryApplyUpdates();
    }
  }

  // https://webpack.js.org/concepts/hot-module-replacement
  import.meta.webpackHot.check(true).then(
    (updatedModules) => {
      handleApplyUpdates(null, updatedModules);
    },
    (err) => {
      handleApplyUpdates(err, null);
    },
  );
}

const MAX_RETRIES = 100;
let connection: WebSocket | null = null;
let retry_counter = 0;

function onOpen() {
  if (typeof console !== 'undefined' && typeof console.info === 'function') {
    // Notify users that the HMR has successfully connected.
    console.info('[HMR] connected.');
  }
}

function onMessage(e: MessageEvent<string>) {
  const message = JSON.parse(e.data);
  switch (message.type) {
    case 'hash':
      clearErrorOverlay();
      handleAvailableHash(message.data);
      break;
    case 'still-ok':
    case 'ok':
      handleSuccess();
      break;
    case 'static-changed':
    case 'content-changed':
      // Triggered when a file from `contentBase` changed.
      window.location.reload();
      break;
    case 'warnings':
      handleWarnings(message.data);
      break;
    case 'errors':
      handleErrors(message.data);
      break;
    default:
    // Do nothing.
  }
}

async function sleep(msec = 1000) {
  return new Promise((resolve) => {
    setTimeout(resolve, msec);
  });
}

async function onClose() {
  if (typeof console !== 'undefined' && typeof console.info === 'function') {
    console.info('[HMR] disconnected. Attempting to reconnect.');
  }

  removeListeners();

  await sleep(1000);
  retry_counter++;

  if (
    connection &&
    (connection.readyState === connection.CONNECTING ||
      connection.readyState === connection.OPEN)
  ) {
    retry_counter = 0;
    return;
  }

  // Exceeded max retry attempts, stop retry.
  if (retry_counter > MAX_RETRIES) {
    if (typeof console !== 'undefined' && typeof console.info === 'function') {
      console.info(
        '[HMR] Unable to establish a connection after exceeding the maximum retry attempts.',
      );
    }
    retry_counter = 0;
    return;
  }

  reconnect();
}

// Establishing a WebSocket connection with the server.
function connect() {
  connection = new WebSocket(socketUrl);

  connection.addEventListener('open', onOpen);
  // Attempt to reconnect after disconnection
  connection.addEventListener('close', onClose);
  // Handle messages from the server.
  connection.addEventListener('message', onMessage);
}

function removeListeners() {
  if (connection) {
    connection.removeEventListener('open', onOpen);
    connection.removeEventListener('close', onClose);
    connection.removeEventListener('message', onMessage);
  }
}

/**
 * Close the current connection if it exists and then establishes a new
 * connection.
 */
function reconnect() {
  if (connection) {
    connection = null;
  }
  connect();
}

connect();
