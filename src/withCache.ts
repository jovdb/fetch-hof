namespace jo {

  export type FetchFn = typeof fetch;

  /** Cache requests in the browser (cannot cache parsed data) */
  export function createPersistentCache(cacheName = "default") {

    const cachePromise: Promise<Cache> | undefined = undefined;
    const getCache = () => cachePromise || caches.open(cacheName);

    type fetchStategy = (url: string| Request, init: RequestInit | undefined, fetch: FetchFn, cancelToken: CancelToken | undefined) => Promise<Response>;

    const strategies: {[strategyName: string]: fetchStategy} = {

      fromNetworkOnly(url: string | Request, init: RequestInit | undefined, fetch: FetchFn) {
        return fetch(url, init);
      },

      fromCacheWithNetworkFallback(url: string | Request, init: RequestInit | undefined, fetch: FetchFn, cancelToken: CancelToken | undefined) {    // use cache if available, but update
        return getCache() // open cache
          .then(cache => {
            if (cancelToken && cancelToken.requested) return undefined;
            return cache.match(url); // get response from cache
          })
          .then(cachedResponse => {

            if (cachedResponse) {
              logger.log("Cached version found, use response from cache");
              return cachedResponse;
            }

            return fetch(url, init)
              // first add result to cache
              .then(function addResponseToChache(response: Response) {
                if (cancelToken && cancelToken.requested) return response; // early exit with response

                return getCache()
                  .then(cache => {
                    if (cancelToken && cancelToken.requested) return response; // early exit with response

                    return cache.put(url, response.clone()) // clone, a stream can only be read once and cache will read it for saving it
                      .then(() => {
                        logger.log("Added to cache");
                        return response;
                      });
                  });

              });
          });
      },

    };

    const result = {

      /** extend a fetch function to add cache (use pipe) */
      withCache<TArgs extends any[]>({
        cachingStategy = "fromCacheWithNetworkFallback",
        getCancelToken,
      }: {
        cachingStategy?: keyof typeof strategies;
        getCancelToken?: (args: TArgs) => CancelToken | undefined;
      } = {}) {

          logger.log("Added caching to Cache Storage");

          return <TFn extends typeof window.fetch>(fn: TFn): TFn => ((...args: TArgs): any => {
            const [url, init] = args;

            return strategies[cachingStategy](url, init, fn, getCancelToken ? getCancelToken(args) : undefined);
          }) as any;
      },

      getAsync(url: string | Request) {
        return getCache().then(cache => cache.match(url));
      },

      hasAsync(url: string | Request) {
        return result.getAsync(url).then(response => !!response);
      },

      deleteAsync(url: string | Request) {
        return getCache().then(cache => cache.delete(url));
      },

      /** Delete the entire cache (example: if cache name contains release) */
      deleteCacheAsync() {
        return caches.delete(cacheName);
      },

    };

    return result;
  }
}