namespace jo {

  export function withTimeout<TArgs extends any[] = any[]>({
    getCancelToken,
    setCancelToken,
    getTimeoutInMs,
    getTimeoutError,
  }: {

    getCancelToken?: (args: TArgs) => CancelToken | undefined;
    setCancelToken?: (newCancelToken: CancelToken, args: TArgs) => TArgs;

    /** You can reject with a custom error */
    getTimeoutError?: (args: TArgs) => Error;

    /** Get delay */
    getTimeoutInMs: (args: TArgs) => number;
  }) {

    return <TFn extends (...args: TArgs) => Promise<any>>(fn: TFn): TFn => ((...args: TArgs) => {

      const cancelToken = getCancelToken ? getCancelToken(args) : undefined;

      return new Promise((resolve, reject) => {

        // Create new Tokens
        const {cancel: cancelTimeout, token: timeoutCancelToken} = CancelToken.source();

        // On timout, we cwant to cancel the running function.
        // We cannot cancel the incomming token because wo only have the token, not the cancel function,
        // Therefor we need to create a new token and pass it down the chain
        const {cancel: cancelChild, token: childCancelToken} = CancelToken.source();

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
        logger.log(`Added Timeout of ${timeoutInMs}ms...`);
        waitAsync({ delayInMs: timeoutInMs, cancelToken: timeoutCancelToken }).then(() => {

          // Timeout passed
          const error = getTimeoutError ? getTimeoutError(args) : new Error(`Timed out after ${timeoutInMs}ms.`);
          logger.error(`Timed out: ${error.message}`);

          // Because promise will be rejected, cancel whatever child is busy,
          cancelChild(error);
          reject(error);
        }, () => undefined); // No unhandled promise exception


        // Call original function
        const newArgs = setCancelToken ? setCancelToken(childCancelToken, args) : args;
        fn(...newArgs)
          .finally(() => {
            // Cancel Timeout, don't cancel child
            cancelTimeout(new CancelError("Promise settled, cancel Timeout"));
          })
          .then(resolve, reject);
      });
    }) as TFn;
  }
}