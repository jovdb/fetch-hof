namespace jo {

  // Fetch remarks
  // - difficult download progress, binary + manual JSON parse
  // - no upload progress
  // - cancelation recently added (AbortController)
  // - no default timeout

  // Let the promise reject with invalid status Codes (404, 500, ...)
  export function withHttpStatusErrors() {

    logger.log(`Added HTTP status validation...`);

    return <TFn extends typeof fetch>(fn: TFn): TFn => ((...args: Parameters<typeof fetch>) => {

      return (fn as any)(...args)

      .then(function checkHtpStatus(response: Response) {
        if (!response.ok) {
          logger.error(`Invalid HTTP status: ${response.status}: ${response.statusText}, rejecting promise`);
          throw new Error(`Fetch failed with HTTP: ${response.status}: ${response.statusText}`); // TODO: Make HTTPError object with more info
        }
        logger.log(`Valid HTTP status: ${response.status}, no reject needed`);
        return response;
      });
    }) as any;
  }
}