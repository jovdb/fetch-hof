namespace jo.logger {

  const logEl = document.getElementById("log");
  let epoch = Date.now();

  // No precise timer
  function getTimeStamp() {
    const ms = Date.now() - epoch;
    return `${' '.repeat(5 - ms.toString().length)}${ms}ms: `;
  }

  export function log(message: string) {
    console.log(message);
    const lineEl = document.createElement("div");
    lineEl.innerText += `${getTimeStamp()}${message}\n`;
    if (logEl) logEl.appendChild(lineEl);
  }

  export function error(message: string) {
    console.error(message);
    const lineEl = document.createElement("div");
    lineEl.classList.add("error");
    lineEl.innerText += `${getTimeStamp()}${message}\n`;
    if (logEl) logEl.appendChild(lineEl);
  }

  export function debug(message: string) {
    /*
    console.debug(message);
    const lineEl = document.createElement("div");
    lineEl.classList.add("debug");
    lineEl.innerText += `${getTimeStamp()}${message}\n`;
    if (logEl) logEl.appendChild(lineEl);
    */
  }

  export function clear() {
    console.log("----------------------------------------");
    epoch = Date.now();
    if (logEl) logEl.innerText = "";
  }
}