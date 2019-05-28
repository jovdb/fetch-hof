namespace jo {

  function waitUntilOnline(cancelToken?: CancelToken) {

    // If online, continue
    if (window.navigator.onLine) return Promise.resolve();

    // Wait until online (or cancelled)
    logger.log("Offline, waiting until online");
    return new Promise<undefined>((resolve, reject) => {

      const unsubscribeCancel = !cancelToken ? undefined :
      cancelToken.subscribe(error => {
        window.removeEventListener('online', whenOnline);
        if (unsubscribeCancel) unsubscribeCancel();
        logger.log("Online check cancelled");
        reject(error || new CancelError("Online check cancelled"));
      });

      function whenOnline() {
        window.removeEventListener('online', whenOnline);
        if (unsubscribeCancel) unsubscribeCancel();
        logger.log("We are back online");
        resolve();
      }
      window.addEventListener('online',  whenOnline);

    });
  }

  // Let a propmise fail if cancelled
  export function withOnlineCheck<TArgs extends any[] = any[]>({
    getCancelToken,
  }: {
    getCancelToken?: (args: TArgs) => CancelToken | undefined;
  }) {

    logger.log("Added online check");
    return <TFn extends (...args: TArgs) => TPromise, TPromise extends Promise<any>>(fn: TFn): TFn => ((...args: TArgs) => {

      const cancelToken = getCancelToken ? getCancelToken(args) : undefined;
      return waitUntilOnline(cancelToken).then(() => fn(...args));

    }) as any;
  }
}