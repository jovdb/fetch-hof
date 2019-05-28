"use strict";
var jo;
(function (jo) {
    function pipe(start, ...fns) {
        // For better type inference, I included the start value as argument
        return fns.reduce(function piping(prevFn, fn) { return fn(prevFn); }, start);
    }
    jo.pipe = pipe;
})(jo || (jo = {}));
var jo;
(function (jo) {
    var logger;
    (function (logger) {
        const logEl = document.getElementById("log");
        let epoch = Date.now();
        // No precise timer
        function getTimeStamp() {
            const ms = Date.now() - epoch;
            return `${' '.repeat(5 - ms.toString().length)}${ms}ms: `;
        }
        function log(message) {
            console.log(message);
            const lineEl = document.createElement("div");
            lineEl.innerText += `${getTimeStamp()}${message}\n`;
            if (logEl)
                logEl.appendChild(lineEl);
        }
        logger.log = log;
        function error(message) {
            console.error(message);
            const lineEl = document.createElement("div");
            lineEl.classList.add("error");
            lineEl.innerText += `${getTimeStamp()}${message}\n`;
            if (logEl)
                logEl.appendChild(lineEl);
        }
        logger.error = error;
        function debug(message) {
            /*
            console.debug(message);
            const lineEl = document.createElement("div");
            lineEl.classList.add("debug");
            lineEl.innerText += `${getTimeStamp()}${message}\n`;
            if (logEl) logEl.appendChild(lineEl);
            */
        }
        logger.debug = debug;
        function clear() {
            console.log("----------------------------------------");
            epoch = Date.now();
            if (logEl)
                logEl.innerText = "";
        }
        logger.clear = clear;
    })(logger = jo.logger || (jo.logger = {}));
})(jo || (jo = {}));
var jo;
(function (jo) {
    // inspired by:
    // https://github.com/zenparsing/es-cancel-token
    // https://github.com/inikulin/cancelable-promise/blob/master/Cancel%20Tokens.md
    // source(): { token, cancel }
    class CancelToken {
        constructor(executer) {
            this._requested = false;
            this._listeners = [];
            executer((error) => {
                this._requested = true;
                this._error = error;
                if (this._listeners)
                    this._listeners.forEach(listener => listener(error));
                this._listeners = undefined;
            });
        }
        /** Synchronously returns a Boolean value indicating whether cancellation has been requested for this token. */
        get requested() {
            return this._requested;
        }
        subscribe(cb) {
            // subscribe
            if (!this._listeners)
                return () => undefined;
            this._listeners.push(cb);
            jo.logger.debug(`subscribed to CancelToken`);
            // Return unsubscribe
            return () => {
                jo.logger.debug(`unsubscribed from CancelToken`);
                if (!this._listeners)
                    return;
                const index = this._listeners.indexOf(cb);
                if (index < 0)
                    return;
                this._listeners.splice(index, 1);
            };
        }
        /** Synchronously throws a CancelError if cancellation has been requested for this token. */
        throwIfRequested() {
            if (this._requested)
                throw this._error;
        }
        /** Create a child token that will cancel if the parent cancels, but can independently be canceled without affecting the parent */
        createChildToken(executer) {
            return new CancelToken(cancel => {
                this.subscribe(error => cancel(error));
            });
        }
        /** Create a new token that will cancel if one of the specified tokens cancels */
        static race(...tokens) {
            return new CancelToken(cancel => {
                for (const token of tokens) {
                    token.subscribe(error => cancel(error));
                }
            });
        }
        static source() {
            let _cancel;
            const token = new CancelToken(cancel => _cancel = cancel);
            return { cancel: _cancel, token };
        }
    }
    jo.CancelToken = CancelToken;
    class CancelError extends Error {
        constructor(message) {
            super(message);
            this.name = "CancelError";
        }
    }
    jo.CancelError = CancelError;
    function isCancelError(error) {
        return error instanceof Error && error.name === "CancelError";
    }
    jo.isCancelError = isCancelError;
})(jo || (jo = {}));
var jo;
(function (jo) {
    function myFetch(url, init) {
        jo.logger.log(`Fetching '${typeof url === "string" ? url : url.url}'...`);
        return fetch(url, init);
    }
    jo.myFetch = myFetch;
})(jo || (jo = {}));
var jo;
(function (jo) {
    function withFetchAbort({ getCancelToken, }) {
        jo.logger.log(`Added abortability to fetch`);
        return (fn) => ((...args) => {
            const [url, init] = args;
            const cancelToken = getCancelToken(args);
            if (!cancelToken)
                throw new Error("CancelToken is required");
            if (init && init.signal)
                throw new Error("cannot add Abortability, fetch is already aborterable");
            jo.logger.log(`Added AbortController to fetch`);
            const abortController = new AbortController();
            const signal = abortController.signal;
            let unsubscribe;
            return new Promise((resolve, reject) => {
                if (cancelToken) {
                    unsubscribe = cancelToken.subscribe(abortError => {
                        // Reject with custom exception
                        jo.logger.log("Aborting fetch...");
                        reject(abortError || new Error("Fetch is cancelled"));
                        abortController.abort();
                    });
                }
                // Start fetching
                fn(url, { ...init, signal })
                    .then(resolve, reject);
                // Remark: don't unsubscribe, when calling json, blob, ... the abort also works
            }).finally(() => {
                if (unsubscribe)
                    unsubscribe(); // If completed an not canceled unsubscribe from CancelToken
            });
        });
    }
    jo.withFetchAbort = withFetchAbort;
})(jo || (jo = {}));
var jo;
(function (jo) {
    /** Cache requests in the browser (cannot cache parsed data) */
    function createPersistentCache(cacheName = "default") {
        const cachePromise = undefined;
        const getCache = () => cachePromise || caches.open(cacheName);
        const strategies = {
            fromNetworkOnly(url, init, fetch) {
                return fetch(url, init);
            },
            fromCacheWithNetworkFallback(url, init, fetch, cancelToken) {
                return getCache() // open cache
                    .then(cache => {
                    if (cancelToken && cancelToken.requested)
                        return undefined;
                    return cache.match(url); // get response from cache
                })
                    .then(cachedResponse => {
                    if (cachedResponse) {
                        jo.logger.log("Cached version found, use response from cache");
                        return cachedResponse;
                    }
                    return fetch(url, init)
                        // first add result to cache
                        .then(function addResponseToChache(response) {
                        if (cancelToken && cancelToken.requested)
                            return response; // early exit with response
                        return getCache()
                            .then(cache => {
                            if (cancelToken && cancelToken.requested)
                                return response; // early exit with response
                            return cache.put(url, response.clone()) // clone, a stream can only be read once and cache will read it for saving it
                                .then(() => {
                                jo.logger.log("Added to cache");
                                return response;
                            });
                        });
                    });
                });
            },
        };
        const result = {
            /** extend a fetch function to add cache (use pipe) */
            withCache({ cachingStategy = "fromCacheWithNetworkFallback", getCancelToken, } = {}) {
                jo.logger.log("Added caching to Cache Storage");
                return (fn) => ((...args) => {
                    const [url, init] = args;
                    return strategies[cachingStategy](url, init, fn, getCancelToken ? getCancelToken(args) : undefined);
                });
            },
            getAsync(url) {
                return getCache().then(cache => cache.match(url));
            },
            hasAsync(url) {
                return result.getAsync(url).then(response => !!response);
            },
            deleteAsync(url) {
                return getCache().then(cache => cache.delete(url));
            },
            /** Delete the entire cache (example: if cache name contains release) */
            deleteCacheAsync() {
                return caches.delete(cacheName);
            },
        };
        return result;
    }
    jo.createPersistentCache = createPersistentCache;
})(jo || (jo = {}));
var jo;
(function (jo) {
    function waitAsync({ delayInMs = 1000, value, cancelToken, }) {
        let unsubscribeFromCancelToken;
        const unsubscribe = () => {
            if (unsubscribeFromCancelToken) {
                unsubscribeFromCancelToken();
                unsubscribeFromCancelToken = undefined;
            }
        };
        return new Promise((resolve, reject) => {
            if (cancelToken)
                cancelToken.throwIfRequested();
            const timeoutId = setTimeout(() => {
                unsubscribe();
                resolve(value);
            }, delayInMs);
            if (cancelToken) {
                unsubscribeFromCancelToken = cancelToken.subscribe(error => {
                    clearTimeout(timeoutId); // cancel timer
                    unsubscribe();
                    jo.logger.log("waitAsync cancelled");
                    reject(error || new jo.CancelError(`waitAsync of ${delayInMs} cancelled`));
                });
            }
        });
    }
    jo.waitAsync = waitAsync;
})(jo || (jo = {}));
var jo;
(function (jo) {
    function withProgress({ onProgress, getCancelToken, }) {
        // https://github.com/AnthumChris/fetch-progress-indicators/
        jo.logger.log(`Added progress for fetch...`);
        return (fn) => ((...args) => {
            const [input, init] = args;
            const request = (input instanceof Request) ? input : new Request(input);
            const cancelToken = getCancelToken ? getCancelToken(args) : undefined;
            return fn(request, init).then(response => {
                // https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
                if (!response.body)
                    throw Error('ReadableStream not yet supported in this browser.');
                if (cancelToken) {
                    // this occurs if cancel() was called before server responded (before fetch() Promise resolved)
                    if (cancelToken.requested) {
                        response.body.getReader().cancel();
                        cancelToken.throwIfRequested();
                    }
                }
                // Server must send CORS header "Access-Control-Expose-Headers: content-length" to access
                // https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#Access-Control-Expose-Headers
                const contentLength = response.headers.get('content-length');
                if (contentLength === null)
                    jo.logger.error('Content-Length response header unavailable, no total available for progess.');
                let loaded = 0;
                let total = contentLength === null ? undefined : +contentLength;
                onProgress({ loaded, total });
                const reader = response.body.getReader();
                return new Response(new ReadableStream({
                    start(controller) {
                        function read() {
                            // Cancelled?
                            if (cancelToken && cancelToken.requested) {
                                jo.logger.log('Cancelling fetch progress reader');
                                reader.cancel();
                                // TODO: CancelError not available
                                try {
                                    cancelToken.throwIfRequested();
                                }
                                catch (cancelError) {
                                    controller.error(cancelError);
                                }
                                return;
                            }
                            reader.read()
                                .then(({ done, value }) => {
                                if (done) {
                                    // ensure onProgress called when content-length=0
                                    if (total === 0) {
                                        onProgress({ loaded, total });
                                    }
                                    controller.close();
                                    return;
                                }
                                loaded += value.byteLength;
                                onProgress({ loaded, total });
                                controller.enqueue(value);
                                read();
                            })
                                .catch(error => {
                                jo.logger.error(`Fetch progress reading error ${error.name}: ${error.message}`);
                                controller.error(error);
                            });
                        }
                        read();
                    }
                }));
            });
        });
    }
    jo.withProgress = withProgress;
})(jo || (jo = {}));
var jo;
(function (jo) {
    function withChaosMonkey({ getCancelToken, shouldThrow = () => Math.random() < 0.2, getDelayInMs = () => Math.floor(3 ** (Math.random() * 8)), }) {
        jo.logger.log(`Added Chaos Monkey 🐵...`);
        return (fn) => ((...args) => {
            const cancelToken = getCancelToken ? getCancelToken(args) : undefined;
            const delayInMs = getDelayInMs();
            const willThrow = shouldThrow();
            jo.logger.log(`Chaos Monkey 🐵 will add ${delayInMs}ms delay ${willThrow ? "with" : "without"} error.`);
            // Call original function
            return fn(...args)
                // Add random Delay
                .then((result) => jo.waitAsync({
                cancelToken,
                delayInMs,
                value: result,
            }).catch(() => result)) // If canceled, just retrun result
                // Add random Error
                .then((result) => {
                // Throw if not canceled
                if (willThrow && (cancelToken ? !cancelToken.requested : true))
                    throw new Error("Thrown by Chaos Monkey 🐵");
                return result;
            });
        });
    }
    jo.withChaosMonkey = withChaosMonkey;
})(jo || (jo = {}));
var jo;
(function (jo) {
    // Fetch remarks
    // - difficult download progress, binary + manual JSON parse
    // - no upload progress
    // - cancelation recently added (AbortController)
    // - no default timeout
    // Let the promise reject with invalid status Codes (404, 500, ...)
    function withHttpStatusErrors() {
        jo.logger.log(`Added HTTP status validation...`);
        return (fn) => ((...args) => {
            return fn(...args)
                .then(function checkHtpStatus(response) {
                if (!response.ok) {
                    jo.logger.error(`Invalid HTTP status: ${response.status}: ${response.statusText}, rejecting promise`);
                    throw new Error(`Fetch failed with HTTP: ${response.status}: ${response.statusText}`); // TODO: Make HTTPError object with more info
                }
                jo.logger.log(`Valid HTTP status: ${response.status}, no reject needed`);
                return response;
            });
        });
    }
    jo.withHttpStatusErrors = withHttpStatusErrors;
})(jo || (jo = {}));
var jo;
(function (jo) {
    function waitUntilOnline(cancelToken) {
        // If online, continue
        if (window.navigator.onLine)
            return Promise.resolve();
        // Wait until online (or cancelled)
        jo.logger.log("Offline, waiting until online");
        return new Promise((resolve, reject) => {
            const unsubscribeCancel = !cancelToken ? undefined :
                cancelToken.subscribe(error => {
                    window.removeEventListener('online', whenOnline);
                    if (unsubscribeCancel)
                        unsubscribeCancel();
                    jo.logger.log("Online check cancelled");
                    reject(error || new jo.CancelError("Online check cancelled"));
                });
            function whenOnline() {
                window.removeEventListener('online', whenOnline);
                if (unsubscribeCancel)
                    unsubscribeCancel();
                jo.logger.log("We are back online");
                resolve();
            }
            window.addEventListener('online', whenOnline);
        });
    }
    // Let a propmise fail if cancelled
    function withOnlineCheck({ getCancelToken, }) {
        jo.logger.log("Added online check");
        return (fn) => ((...args) => {
            const cancelToken = getCancelToken ? getCancelToken(args) : undefined;
            return waitUntilOnline(cancelToken).then(() => fn(...args));
        });
    }
    jo.withOnlineCheck = withOnlineCheck;
})(jo || (jo = {}));
var jo;
(function (jo) {
    function withTimeout({ getCancelToken, setCancelToken, getTimeoutInMs, getTimeoutError, }) {
        return (fn) => ((...args) => {
            const cancelToken = getCancelToken ? getCancelToken(args) : undefined;
            return new Promise((resolve, reject) => {
                // Create new Tokens
                const { cancel: cancelTimeout, token: timeoutCancelToken } = jo.CancelToken.source();
                // On timout, we cwant to cancel the running function.
                // We cannot cancel the incomming token because wo only have the token, not the cancel function,
                // Therefor we need to create a new token and pass it down the chain
                const { cancel: cancelChild, token: childCancelToken } = jo.CancelToken.source();
                // If parent cancels, also cancel Timeout and child
                if (cancelToken) {
                    cancelToken.subscribe(error => {
                        // Cancel Timeout and child
                        cancelTimeout(error);
                        cancelChild(error);
                        reject(error);
                    });
                }
                // Start timeout
                const timeoutInMs = getTimeoutInMs ? getTimeoutInMs(args) : 1000;
                jo.logger.log(`Added Timeout of ${timeoutInMs}ms...`);
                jo.waitAsync({ delayInMs: timeoutInMs, cancelToken: timeoutCancelToken }).then(() => {
                    // Timeout passed
                    const error = getTimeoutError ? getTimeoutError(args) : new Error(`Timed out after ${timeoutInMs}ms.`);
                    jo.logger.error(`Timed out: ${error.message}`);
                    // Because promise will be rejected, cancel whatever child is busy,
                    cancelChild(error);
                    reject(error);
                }, () => undefined); // No unhandled promise exception
                // Call original function
                const newArgs = setCancelToken ? setCancelToken(childCancelToken, args) : args;
                fn(...newArgs)
                    .finally(() => {
                    // Cancel Timeout, don't cancel child
                    cancelTimeout(new jo.CancelError("Promise settled, cancel Timeout"));
                })
                    .then(resolve, reject);
            });
        });
    }
    jo.withTimeout = withTimeout;
})(jo || (jo = {}));
var jo;
(function (jo) {
    function withRetry({ getRetryDelayInMs = (retryCount) => retryCount === 0 ? 1000 : -1, getCancelToken, }) {
        // Accepts a fetch function and returns new fetch function
        return (fn) => ((...args) => {
            jo.logger.log(`Added retries...`);
            return new Promise((resolve, reject) => {
                // Create new Tokens
                const cancelToken = getCancelToken ? getCancelToken(args) : undefined;
                function rejectOnCancel() {
                    // Throw if error, this will reject the promise
                    try {
                        if (cancelToken) {
                            cancelToken.throwIfRequested();
                        }
                    }
                    catch (err) {
                        jo.logger.error("Retry detected a Cancelation.");
                        reject(err);
                        return true;
                    }
                    return false;
                }
                let retryCounter = 0;
                function execAsync() {
                    if (rejectOnCancel())
                        return;
                    // Execute
                    fn(...args).then((result) => { resolve(result); }, (err) => {
                        if (rejectOnCancel())
                            return;
                        // End of retry?
                        const retryDelayInMs = getRetryDelayInMs(retryCounter, err, args);
                        if (retryDelayInMs < 0) {
                            jo.logger.log("No more retries");
                            reject(err);
                            return;
                        }
                        // Retry
                        retryCounter++;
                        jo.logger.error(`Retry detected an error: ${err.name}: ${err.message}`);
                        jo.logger.log(`Retry #${retryCounter} in ${retryDelayInMs}ms...`);
                        // Delay
                        jo.waitAsync({ delayInMs: retryDelayInMs, cancelToken })
                            .then(() => execAsync(), err => {
                            jo.logger.log(`Canceling retry delay`);
                            reject(err);
                        });
                    });
                }
                // Start
                execAsync();
            });
        });
    }
    jo.withRetry = withRetry;
})(jo || (jo = {}));
var jo;
(function (jo) {
    const execEl = document.getElementById("exec");
    const urlEl = document.getElementById("url");
    const chkProgressEl = document.getElementById("add-progress");
    const progressEl = document.getElementById("progress");
    const progressTextEl = document.getElementById("progress-text");
    const chkChaosEl = document.getElementById("add-chaos");
    const chkCachingEl = document.getElementById("add-caching");
    const btnClearCacheEl = document.getElementById("clear-cache");
    const chkOnlineEl = document.getElementById("add-online-check");
    const chkHttpStatusEl = document.getElementById("add-http-status");
    const chkFetchTimeoutEl = document.getElementById("add-fetch-timeout");
    const fetchTimeoutEl = document.getElementById("fetch-timeout");
    const chkRetryEl = document.getElementById("add-retry");
    const retryCountEl = document.getElementById("retry-count");
    const retryDelayEl = document.getElementById("retry-delay");
    const chkTotalTimeoutEl = document.getElementById("add-total-timeout");
    const totalTimeoutEl = document.getElementById("total-timeout");
    const chkCancelEl = document.getElementById("add-cancel");
    const btnCancelEl = document.getElementById("cancel");
    const passThrough = (fn) => fn;
    function loadImageAsync(url) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error("Error loading image"));
            image.onabort = () => reject(new Error("Loading image aborted"));
            image.src = url;
        });
    }
    const cache = jo.createPersistentCache();
    function getImageSize(url, { cancelToken } = {}) {
        // Get or set CancelToken in the argumentss
        const getCancelTokenFromFetch = ([_, init]) => init && init.cancelToken;
        const getCancelToken = ([cancelToken]) => cancelToken;
        const setCancelToken = (newCancelToken, args) => [newCancelToken];
        // Add behavior to the standard fetch
        return jo.pipe(
        // Default fetch but with logging
        jo.myFetch, 
        // Addbuild abortability
        !chkCancelEl.checked && !chkFetchTimeoutEl.checked && !chkRetryEl.checked && !chkTotalTimeoutEl.checked ? passThrough :
            jo.withFetchAbort({
                getCancelToken: getCancelTokenFromFetch,
            }), 
        // Let a 404 reject
        !chkHttpStatusEl.checked ? passThrough :
            jo.withHttpStatusErrors(), !chkProgressEl.checked ? passThrough :
            jo.withProgress({
                onProgress(info) {
                    progressEl.style.display = info.total ? "inline" : "none";
                    if (info.total) {
                        progressEl.value = info.loaded / info.total * 100;
                    }
                    progressTextEl.innerText = `: ${Math.ceil(info.loaded / 1024)}${info.total ? `/${Math.ceil(info.total / 1024)}` : ""}KB`;
                },
                getCancelToken: getCancelTokenFromFetch,
            }), !chkChaosEl.checked ? passThrough :
            jo.withChaosMonkey({
                getCancelToken: getCancelTokenFromFetch,
            }), !chkOnlineEl.checked ? passThrough :
            jo.withOnlineCheck({
                getCancelToken: getCancelTokenFromFetch,
            }), !chkCachingEl.checked ? passThrough :
            cache.withCache({
                getCancelToken: getCancelTokenFromFetch,
            }), 
        // The main function
        // here we execute the fetch, with parsing the response and loading the image, because
        // the following methods  (Retry/Timeout) should also include reading the bob and loading of the image
        // Here the signature changes
        fetch => (cancelToken) => fetch(url, { cancelToken }) // use cancelToken as input, so each HOF can use the current one instead of the global one
            .then(response => {
            if (cancelToken)
                cancelToken.throwIfRequested();
            jo.logger.log("Reading response as blob...");
            return response.blob();
        })
            .then(blob => {
            if (cancelToken)
                cancelToken.throwIfRequested();
            jo.logger.log("Reading image from blob...");
            return loadImageAsync(URL.createObjectURL(blob));
        })
            .then(({ width, height }) => ({ width, height })), fn => fn, 
        // Add timeout and use cancelToken so fetch can be aborted
        !chkFetchTimeoutEl.checked ? passThrough :
            jo.withTimeout({
                getTimeoutInMs: () => +fetchTimeoutEl.value,
                getTimeoutError: () => new Error(`Fetch timed out after ${+fetchTimeoutEl.value}ms.`),
                getCancelToken,
                setCancelToken,
            }), 
        // Add retry and use cancelToken to stop a running fetch and stop retries
        !chkRetryEl.checked ? passThrough :
            jo.withRetry({
                getRetryDelayInMs: (retryCount) => retryCount < +retryCountEl.value ? +retryDelayEl.value : -1,
                getCancelToken,
            }), 
        // Add timeout and use cancelToken so fetch can be aborted
        !chkTotalTimeoutEl.checked ? passThrough :
            jo.withTimeout({
                getTimeoutInMs: () => +totalTimeoutEl.value,
                getTimeoutError: () => new Error(`Total time of ${+totalTimeoutEl.value} ms exceeded for request: '${url}'.`),
                getCancelToken,
                setCancelToken,
            }))(cancelToken);
    }
    const cancelToken = new jo.CancelToken(cancel => {
        btnCancelEl && btnCancelEl.addEventListener("click", e => {
            e.preventDefault(); // prevent post;
            e.stopPropagation();
            if (cancelToken) {
                jo.logger.log(`Cancel button clicked`);
                cancel(new jo.CancelError("Cancel button clicked"));
            }
        });
    });
    execEl && execEl.addEventListener("click", () => {
        jo.logger.clear();
        if (chkCancelEl.checked)
            btnCancelEl.disabled = false;
        execEl.disabled = true;
        getImageSize(urlEl.value, { cancelToken })
            .then(({ width, height }) => jo.logger.log(`Image size: ${width}x${height}`))
            .catch(err => jo.logger.error(`Could not get image size: ${err.name}: ${err.message}`))
            .finally(() => {
            execEl.disabled = false;
            if (chkCancelEl.checked)
                btnCancelEl.disabled = true;
        });
    });
    btnClearCacheEl && btnClearCacheEl.addEventListener("click", e => {
        e.preventDefault(); // prevent post;
        e.stopPropagation();
        if (cache) {
            cache.deleteCacheAsync();
        }
    });
})(jo || (jo = {}));
var jo;
(function (jo) {
    // Boxed myself some test functions that I can use without the need of a dependency
    function getErrorMessage(result) {
        if (!result)
            return ""; // OK
        if (result === true)
            return "Failed";
        return `${result}`;
    }
    const isPromise = (o) => !!(o && o.then);
    const use = ({ before, after, cb }) => {
        const beforeResult = before();
        try {
            const result = cb(beforeResult);
            if (isPromise(result)) {
                return result.then(r => {
                    after(beforeResult);
                    return r;
                }).catch(err => {
                    after(beforeResult, err);
                    throw err;
                });
            }
            else {
                after(beforeResult);
                return result;
            }
        }
        catch (err) {
            after(beforeResult, err);
            throw err;
        }
    };
    function createTester(logger) {
        function group(groupName, cb, groupInfos = []) {
            function test(testName, cb, groupInfos = []) {
                const errorMessages = [];
                const promise = new Promise(resolve => {
                    const done = () => {
                        resolve();
                    };
                    const fail = (result) => {
                        const errorMessage = getErrorMessage(result);
                        if (errorMessage)
                            errorMessages.push(errorMessage);
                    };
                    cb({ done, fail });
                });
                return use({
                    before: () => logger.testStart(testName, groupInfos[groupInfos.length - 1]),
                    cb: () => promise,
                    after: (testInfo) => logger.testEnd(errorMessages, testInfo),
                });
            }
            use({
                before: () => {
                    return logger.groupStart(groupName);
                },
                cb: groupInfo => {
                    cb({
                        test(testName, cb) {
                            return test(testName, cb, [...groupInfos, groupInfo]);
                        },
                        group(groupName, cb) {
                            group(groupName, cb, groupInfos);
                        }
                    });
                },
                after: groupInfo => {
                    logger.groupEnd(groupInfo);
                },
            });
        }
        return {
            group,
        };
    }
    jo.createTester = createTester;
    function createTesterToDiv(el) {
        const logger = {
            groupStart: groupName => {
                const groupEl = document.createElement("div");
                groupEl.classList.add("test__group", "test__group--busy");
                groupEl.innerText = groupName;
                el.appendChild(groupEl);
                return groupEl;
            },
            testStart: (testName, groupEl) => {
                const lineEl = document.createElement("div");
                lineEl.innerText = testName;
                lineEl.classList.add("test__result");
                lineEl.classList.add("test__result--busy");
                groupEl.appendChild(lineEl);
                return lineEl;
            },
            testEnd: (errorMessages, lineEl) => {
                lineEl.classList.remove("test__result--busy");
                if (!errorMessages || errorMessages.length === 0) {
                    lineEl.classList.add("test__result--success");
                }
                else {
                    lineEl.classList.add("test__result--failed");
                    const errorsEl = document.createElement("div");
                    errorsEl.classList.add("error__lines");
                    errorMessages.forEach(msg => {
                        const errorEl = document.createElement("div");
                        errorEl.innerText = msg;
                        errorEl.classList.add("error__line");
                        errorsEl.appendChild(errorEl);
                    });
                    lineEl.appendChild(errorsEl);
                }
            },
            groupEnd: groupEl => {
                groupEl.classList.remove("test__group--busy");
                groupEl.classList.add("test__group--success");
            },
        };
        return createTester(logger);
    }
    jo.createTesterToDiv = createTesterToDiv;
    const testsEl = document.getElementById("tests");
    jo.tester = testsEl
        ? createTesterToDiv(testsEl)
        : undefined;
})(jo || (jo = {}));
var jo;
(function (jo) {
    const delayAsync = (delayInMs) => new Promise(resolve => {
        setTimeout(resolve, delayInMs);
    });
    const info = [{
            testName: "should not fail if not timed out",
            durationInMs: 10,
            timeoutInMs: 15,
            cancelInfo: undefined,
            cancelDelayInMs: undefined,
            shouldFail: false,
        }, {
            testName: "should fail because timed out",
            durationInMs: 10,
            timeoutInMs: 5,
            cancelInfo: undefined,
            cancelDelayInMs: undefined,
            shouldFail: true,
            isValidateError: err => err.message === "TO",
        }, {
            testName: "should fail because timed out and cancelToken not called",
            durationInMs: 10,
            timeoutInMs: 5,
            cancelInfo: jo.CancelToken.source(),
            cancelDelayInMs: undefined,
            shouldFail: true,
            isValidateError: err => err.message === "TO",
        }, {
            testName: "should fail because timed out and cancelled after resolve",
            durationInMs: 10,
            timeoutInMs: 5,
            cancelInfo: jo.CancelToken.source(),
            cancelDelayInMs: 15,
            shouldFail: true,
            isValidateError: err => err.message === "TO",
        }, {
            testName: "should fail because canceled",
            durationInMs: 15,
            timeoutInMs: 10,
            cancelInfo: jo.CancelToken.source(),
            cancelDelayInMs: 5,
            shouldFail: true,
            isValidateError: err => err.message === "C",
        }, {
            testName: "should not fail if cancelled after resolve",
            durationInMs: 5,
            timeoutInMs: 15,
            cancelInfo: jo.CancelToken.source(),
            cancelDelayInMs: 15,
            shouldFail: false
        }];
    jo.tester && jo.tester.group("withTimeout", ({ test }) => {
        return Promise.all(
        // 2 Durations
        info.map(({ durationInMs, isValidateError, timeoutInMs, testName, cancelDelayInMs, cancelInfo, shouldFail }) => {
            return test(testName, ({ fail, done }) => {
                // Cancel
                if (cancelDelayInMs && cancelDelayInMs > 0)
                    delayAsync(cancelDelayInMs).then(() => { cancelInfo.cancel(new Error("C")); });
                // Start function with timeout
                return jo.pipe(delayAsync, jo.withTimeout({
                    getTimeoutInMs: () => timeoutInMs,
                    getTimeoutError: () => Error("TO"),
                    getCancelToken: () => cancelInfo ? cancelInfo.token : undefined,
                }))(durationInMs)
                    // Check results
                    .then(() => {
                    // Check Timeout
                    if (shouldFail)
                        fail(`Expected to fail.`);
                    done();
                })
                    .catch(err => {
                    const isOk = shouldFail && (isValidateError ? isValidateError(err, fail) : true);
                    if (!isOk)
                        fail(`Didn't expect to fail.`);
                    done();
                });
            });
        }));
    });
})(jo || (jo = {}));
var jo;
(function (jo) {
    const info = [{
            testName: "should execute and fail, no retries",
            durationInMs: 10,
            cancelInfo: undefined,
            cancelDelayInMs: undefined,
            getRetryDelayInMs: () => -1,
            validate: (err, fail, executionCount) => {
                if (!err)
                    fail("Expected to fail");
                if (executionCount !== 1)
                    fail("Expected to execute once");
            },
        }, {
            testName: "should execute, retry twice and fail",
            durationInMs: 10,
            cancelInfo: undefined,
            cancelDelayInMs: undefined,
            getRetryDelayInMs: retryCount => retryCount < 2 ? 10 : -1,
            validate: (err, fail, executionCount) => {
                if (!err)
                    fail("Expected to fail");
                if (executionCount !== 3)
                    fail(`Executed #${executionCount}, Expected to execute 3x`);
            },
        }, {
            testName: "should cancel during second retry delay",
            durationInMs: 10,
            cancelInfo: jo.CancelToken.source(),
            cancelDelayInMs: 28,
            getRetryDelayInMs: retryCount => retryCount < 5 ? 10 : -1,
            validate: (err, fail, executionCount) => {
                if (!err)
                    fail("Expected to fail");
                if (err && err.message !== "C")
                    fail("Expected to fail with CancelError");
                if (executionCount !== 1)
                    fail(`Executed #${executionCount}, Expected to execute 2x`);
            },
        }, {
            testName: "should cancel during execution",
            durationInMs: 20,
            cancelInfo: jo.CancelToken.source(),
            cancelDelayInMs: 35,
            getRetryDelayInMs: retryCount => retryCount < 5 ? 10 : -1,
            validate: (err, fail, executionCount) => {
                if (!err)
                    fail("Expected to fail");
                if (err && err.message !== "C")
                    fail("Expected to fail with CancelError");
                if (executionCount !== 1)
                    fail(`Executed #${executionCount}, Expected to execute 2x`);
            },
        }];
    jo.tester && jo.tester.group("withRetry", ({ test }) => {
        return Promise.all(
        // 2 Durations
        info.map(({ durationInMs, validate, testName, getRetryDelayInMs, cancelDelayInMs, cancelInfo }) => {
            // Should cancel?
            if (cancelInfo && cancelDelayInMs) {
                jo.waitAsync({ delayInMs: cancelDelayInMs })
                    .then(() => {
                    jo.logger.log("Canceling");
                    cancelInfo.cancel(new jo.CancelError("C"));
                });
            }
            return test(testName, ({ fail, done }) => {
                let executionCount = 0;
                // Start function with timeout
                return jo.pipe((cancelToken) => {
                    jo.logger.log(`Executing async call (${durationInMs}ms)...`);
                    ++executionCount;
                    return jo.waitAsync({
                        delayInMs: durationInMs,
                        cancelToken,
                    }).then(() => {
                        jo.logger.log("Async call ends with error.");
                        throw new Error("A");
                    });
                }, jo.withRetry({
                    getRetryDelayInMs,
                    getCancelToken: cancelInfo ? args => args[0] : undefined,
                }))(cancelInfo ? cancelInfo.token : undefined)
                    // Check results
                    .then(() => {
                    // Check Timeout
                    validate(undefined, fail, executionCount);
                    done();
                })
                    .catch(err => {
                    validate(err, fail, executionCount);
                    done();
                });
            });
        }));
    });
})(jo || (jo = {}));
