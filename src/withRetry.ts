namespace jo {
  export function withRetry<TArgs extends any[]>({
    getRetryDelayInMs = (retryCount) => retryCount === 0 ? 1000 : -1,
    getCancelToken,
  }: {
    /** Get delay for retry, return negative value to stop retrying */
    getRetryDelayInMs?: (retryCount: number, err: any, args: TArgs) => number;
    getCancelToken?: (args: TArgs) => CancelToken | undefined;
  }) {

    // Accepts a fetch function and returns new fetch function
    return <TFn extends (...args: TArgs) => Promise<any>>(fn: TFn): TFn => ((...args: TArgs) => {

      logger.log(`Added retries...`);

      return new Promise((resolve, reject) => {

        // Create new Tokens
        const cancelToken = getCancelToken ? getCancelToken(args) : undefined;

        function rejectOnCancel() {
          // Throw if error, this will reject the promise
          try {
            if (cancelToken) {
              cancelToken.throwIfRequested();
            }
          } catch(err) {
            logger.error("Retry detected a Cancelation.");
            reject(err);
            return true;
          }
          return false;
        }

        let retryCounter = 0;
        function execAsync() {

          if (rejectOnCancel()) return;

          // Execute
          fn(...args).then(
            (result: any) => { resolve(result); },
            (err: any) => {

              if (rejectOnCancel()) return;

              // End of retry?
              const retryDelayInMs = getRetryDelayInMs(retryCounter,  err, args);
              if (retryDelayInMs < 0) {
                logger.log("No more retries");
                reject(err);
                return;
              }

              // Retry
              retryCounter++;
              logger.error(`Retry detected an error: ${err.name}: ${err.message}`);
              logger.log(`Retry #${retryCounter} in ${retryDelayInMs}ms...`);

              // Delay
              waitAsync({ delayInMs: retryDelayInMs, cancelToken })
                .then(() => execAsync(), err => {
                  logger.log(`Canceling retry delay`);
                  reject(err);
                });

            }
          );
        }

        // Start
        execAsync();
      });
    }) as any;
  }
}