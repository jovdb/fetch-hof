namespace jo {

  export function withProgress<TArgs extends any[]>({
    onProgress,
    getCancelToken,
  }: {
    onProgress: (info: {loaded: number; total?: number}) => void;
    getCancelToken?: (args: TArgs) => CancelToken | undefined;
  }) {

      // https://github.com/AnthumChris/fetch-progress-indicators/

      logger.log(`Added progress for fetch...`);

      return <TFn extends typeof fetch>(fn: TFn): TFn => ((...args: TArgs) => {

        const [input, init] = args;
        const request = (input instanceof Request) ? input : new Request(input);
        const cancelToken = getCancelToken ? getCancelToken(args) : undefined;

        return fn(request, init).then(response => {

          // https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
          if (!response.body) throw Error('ReadableStream not yet supported in this browser.');


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
          if (contentLength === null) logger.error('Content-Length response header unavailable, no total available for progess.');

          let loaded = 0;
          let total = contentLength === null ? undefined : +contentLength;

          onProgress({loaded, total});

          const reader = response.body.getReader();

          return new Response(
            new (ReadableStream as any)({
              start(controller: ReadableByteStreamController) {

                function read() {

                  // Cancelled?
                  if (cancelToken && cancelToken.requested) {
                    logger.log('Cancelling fetch progress reader');
                    reader.cancel();
// TODO: CancelError not available
                    try {
                      cancelToken.throwIfRequested();
                    } catch (cancelError) {
                      controller.error(cancelError);
                    }
                    return;
                  }

                  reader.read()
                    .then(({done, value}) => {
                      if (done) {
                        // ensure onProgress called when content-length=0
                        if (total === 0) { onProgress({loaded, total}); }
                        controller.close();
                        return;
                      }

                      loaded += value.byteLength;
                      onProgress({loaded, total});
                      controller.enqueue(value);
                      read();
                    })
                    .catch(error => {
                      logger.error(`Fetch progress reading error ${error.name}: ${error.message}`);
                      controller.error(error);
                    });
                }

                read();
              }
            })
          );
        });
      }) as any;
  }
}
