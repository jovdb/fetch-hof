namespace jo {

  export function myFetch(url: string | Request, init?: RequestInit) {
      logger.log(`Fetching '${typeof url === "string" ? url : url.url }'...`);
      return fetch(url, init);
  }

}