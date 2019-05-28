namespace jo {

  export function waitAsync<TValue extends any = undefined>({
    delayInMs = 1000,
    value,
    cancelToken,
  }: {
    delayInMs: number;
    value?: TValue;
    cancelToken?: CancelToken;
  }) {

    let unsubscribeFromCancelToken: undefined | (() => void);
    const unsubscribe = () => {
      if (unsubscribeFromCancelToken) {
        unsubscribeFromCancelToken();
        unsubscribeFromCancelToken = undefined;
      }
    };

    return new Promise<TValue>((resolve, reject) => {

      if (cancelToken) cancelToken.throwIfRequested();

      const timeoutId = setTimeout(() => {
        unsubscribe();
        resolve(value);
      }, delayInMs);

      if (cancelToken) {
        unsubscribeFromCancelToken = cancelToken.subscribe(error => {
          clearTimeout(timeoutId); // cancel timer
          unsubscribe();
          logger.log("waitAsync cancelled");
          reject(error || new CancelError(`waitAsync of ${delayInMs} cancelled`));
        });
      }
    });
  }
}