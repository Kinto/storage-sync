kinto-chrome
============

Prototype project to build a [chrome.storage.sync](https://developer.chrome.com/extensions/storage)
compatible wrapper around Kinto.js.

To make it sync to a Kinto server, configure as follows:

````js
chrome.storage.sync.config = {
  type: "kinto",
  interval: 60000, // milliseconds
  remote: "http://localhost:8080/v1",
  headers: {Authorization: "Basic " + btoa("user:pass")}
};
````
