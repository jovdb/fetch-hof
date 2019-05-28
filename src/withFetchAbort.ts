namespace jo {

  export function withFetchAbort<TArgs extends any[]>({
    getCancelToken,
  }:{
    getCancelToken: (...args: TArgs[]) => CancelToken | undefined;
  }) {

    logger.log(`Added abortability to fetch`);

    return <TFn extends FetchFn>(fn: TFn): TFn => ((...args: TArgs) => {

      const [url, init] = args;
      const cancelToken = getCancelToken(args);

      if (!cancelToken) throw new Error("CancelToken is required");
      if (init && init.signal) throw new Error("cannot add Abortability, fetch is already aborterable");
      logger.log(`Added AbortController to fetch`);

      const abortController = new AbortController();
      const signal = abortController.signal;
      let unsubscribe: (() => void) | undefined;

      return new Promise<any>((resolve, reject) => {
        if (cancelToken) {
          unsubscribe = cancelToken.subscribe(abortError => {
            // Reject with custom exception
            logger.log("Aborting fetch...");
            reject(abortError || new Error("Fetch is cancelled"));
            abortController.abort();
          });
        }

        // Start fetching
        fn(url, { ...init, signal } as any)
          .then(resolve, reject);
          // Remark: don't unsubscribe, when calling json, blob, ... the abort also works

      }).finally(() => {
        if (unsubscribe) unsubscribe(); // If completed an not canceled unsubscribe from CancelToken
      });
    }) as any;
  }
}