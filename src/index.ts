namespace jo {

  const execEl = document.getElementById("exec") as HTMLButtonElement;
  const urlEl = document.getElementById("url") as HTMLInputElement;

  const chkProgressEl = document.getElementById("add-progress") as HTMLInputElement;
  const progressEl = document.getElementById("progress") as HTMLProgressElement;
  const progressTextEl = document.getElementById("progress-text") as HTMLSpanElement;

  const chkChaosEl = document.getElementById("add-chaos") as HTMLInputElement;

  const chkCachingEl = document.getElementById("add-caching") as HTMLInputElement;
  const btnClearCacheEl = document.getElementById("clear-cache") as HTMLButtonElement;

  const chkOnlineEl = document.getElementById("add-online-check") as HTMLInputElement;

  const chkHttpStatusEl = document.getElementById("add-http-status") as HTMLInputElement;

  const chkFetchTimeoutEl = document.getElementById("add-fetch-timeout") as HTMLInputElement;
  const fetchTimeoutEl = document.getElementById("fetch-timeout") as HTMLInputElement;

  const chkRetryEl = document.getElementById("add-retry") as HTMLInputElement;
  const retryCountEl = document.getElementById("retry-count") as HTMLInputElement;
  const retryDelayEl = document.getElementById("retry-delay") as HTMLInputElement;

  const chkTotalTimeoutEl = document.getElementById("add-total-timeout") as HTMLInputElement;
  const totalTimeoutEl = document.getElementById("total-timeout") as HTMLInputElement;
  const chkCancelEl = document.getElementById("add-cancel") as HTMLInputElement;
  const btnCancelEl = document.getElementById("cancel") as HTMLButtonElement;

  const passThrough = <TFn extends Function>(fn: TFn): TFn => fn;

  function loadImageAsync(url: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Error loading image"));
      image.onabort = () => reject(new Error("Loading image aborted"));
      image.src = url;
    });
  }

  const cache = createPersistentCache();

  function getImageSize(url: string, { cancelToken }: { cancelToken?: CancelToken } = {}) {

    // Get or set CancelToken in the argumentss
    const getCancelTokenFromFetch = ([_, init]: [any, {cancelToken?: CancelToken}]) => init && init.cancelToken;
    const getCancelToken = ([cancelToken]: [CancelToken]) => cancelToken;
    const setCancelToken = <T extends [CancelToken | undefined]>(newCancelToken: CancelToken, args: T) => [newCancelToken] as T;


    // Add behavior to the standard fetch
    return pipe(

      // Default fetch but with logging
      myFetch as (input: RequestInfo, init?: RequestInit & { cancelToken?: CancelToken}| undefined) => ReturnType<FetchFn>,

      // Addbuild abortability
      !chkCancelEl.checked && !chkFetchTimeoutEl.checked && !chkRetryEl.checked && !chkTotalTimeoutEl.checked ? passThrough :
      withFetchAbort({
        getCancelToken: getCancelTokenFromFetch,
      }),

      // Let a 404 reject
      !chkHttpStatusEl.checked ? passThrough :
      withHttpStatusErrors(),

      !chkProgressEl.checked ? passThrough :
      withProgress({
        onProgress(info) {
          progressEl.style.display = info.total ? "inline" : "none";
          if (info.total) {
            progressEl.value = info.loaded / info.total * 100;
          }
          progressTextEl.innerText = `: ${Math.ceil(info.loaded / 1024)}${info.total ? `/${Math.ceil(info.total / 1024)}`: ""}KB`;
        },
        getCancelToken: getCancelTokenFromFetch,
      }),


      !chkChaosEl.checked ? passThrough :
      withChaosMonkey({
        getCancelToken: getCancelTokenFromFetch,
      }),

      !chkOnlineEl.checked ? passThrough :
      withOnlineCheck({
        getCancelToken: getCancelTokenFromFetch,
      }),

      !chkCachingEl.checked ? passThrough :
      cache.withCache({
        getCancelToken: getCancelTokenFromFetch,
      }),


      // The main function
      // here we execute the fetch, with parsing the response and loading the image, because
      // the following methods  (Retry/Timeout) should also include reading the bob and loading of the image
      // Here the signature changes
      fetch => (cancelToken: CancelToken | undefined) => fetch(url, { cancelToken } as RequestInit) // use cancelToken as input, so each HOF can use the current one instead of the global one
        .then(response => {
          if (cancelToken) cancelToken.cancelIfRequested();
          logger.log("Reading response as blob...");
          return response.blob();
        })
        .then(blob => {
          if (cancelToken) cancelToken.cancelIfRequested();
          logger.log("Reading image from blob...");
          return loadImageAsync(URL.createObjectURL(blob));
        })
        .then(({ width, height }) => ({ width, height })),
      fn => fn,


      // Add timeout and use cancelToken so fetch can be aborted
      !chkFetchTimeoutEl.checked ? passThrough :
      withTimeout({
        getTimeoutInMs: () => +fetchTimeoutEl.value,
        getTimeoutError: () => new Error(`Fetch timed out after ${+fetchTimeoutEl.value}ms.`),
        getCancelToken,
        setCancelToken,
      }),

      // Add retry and use cancelToken to stop a running fetch and stop retries
      !chkRetryEl.checked ? passThrough :
      withRetry({
        getRetryDelayInMs: (retryCount) => retryCount < +retryCountEl.value ? +retryDelayEl.value : -1,
        getCancelToken,
      }),

      // Add timeout and use cancelToken so fetch can be aborted
      !chkTotalTimeoutEl.checked ? passThrough :
      withTimeout({
        getTimeoutInMs: () => +totalTimeoutEl.value,
        getTimeoutError: () => new Error(`Total time of ${+totalTimeoutEl.value} ms exceeded for request: '${url}'.`),
        getCancelToken,
        setCancelToken,
      }),

    )(cancelToken);
  }

  const cancelToken = new CancelToken(cancel => {
    btnCancelEl && btnCancelEl.addEventListener("click", e => {
      e.preventDefault(); // prevent post;
      e.stopPropagation();
      if (cancelToken) {
        logger.log(`Cancel button clicked`);
        cancel(new CancelError("Cancel button clicked"));
      }
    });
  });

  execEl && execEl.addEventListener("click", () => {

    logger.clear();

    if (chkCancelEl.checked) btnCancelEl.disabled = false;
    execEl.disabled = true;

    getImageSize(urlEl.value, { cancelToken})
      .then(({ width, height }) => logger.log(`Image size: ${width}x${height}`))
      .catch(err => logger.error(`Could not get image size: ${err.name}: ${err.message}`))
      .finally(() => {
        execEl.disabled = false;
        if (chkCancelEl.checked) btnCancelEl.disabled = true;
      });

  });

  btnClearCacheEl && btnClearCacheEl.addEventListener("click", e => {
    e.preventDefault(); // prevent post;
    e.stopPropagation();
    if (cache) {
      cache.deleteCacheAsync();
    }
  });

}