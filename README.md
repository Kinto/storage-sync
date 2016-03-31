storage-sync
============

[![Build Status](https://travis-ci.org/kinto/storage-sync.svg?branch=master)](https://travis-ci.org/kinto/storage-sync)

Prototype project to build a [chrome.storage.sync](https://developer.chrome.com/extensions/storage)
compatible wrapper around Kinto.js.

To see the demo, run:

````bash
nvm use 4.4
mkdir node_modules
cd node_modules
git clone https://github.com/dumbmatter/fakeIndexedDB
mv fakeIndexedDB fake-indexeddb
cd fake-indexeddb
npm install
pwd
mkdir node_modules
cd node_modules
ls
cd fs-extra
npm install
cd ..
cd ..
npm install
cd ..
cd ..

npm install
npm run dist
cd demo ; python -m SimpleHTTPServer
````

and then visit http://localhost:8000/ and see the console.

To make it sync to a Kinto server, configure as follows:

````js
chrome.storage.sync.config = {
  type: "kinto",
  interval: 60000, // milliseconds
  remote: "http://localhost:8080/v1",
  headers: {Authorization: "Basic " + btoa("user:pass")}
};
````

To run the tests, run:

````bash
npm install
npm run test
````
