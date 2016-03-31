storage-sync
============

[![Build Status](https://travis-ci.org/kinto/storage-sync.svg?branch=master)](https://travis-ci.org/kinto/storage-sync)

Prototype project to build a [chrome.storage.sync](https://developer.chrome.com/extensions/storage)
compatible wrapper around Kinto.js.

Work-around while fake-indexeddb is having some dependency hell problems:

```bash
nvm use 4.4
mkdir node_modules
cd node_modules
git clone https://github.com/kinto/storage-sync
cd storage-sync
mkdir node_modules
cd node_modules
git clone https://github.com/dumbmatter/fakeIndexedDB
mv fakeIndexedDB fake-indexeddb
cd fake-indexeddb
npm install
mkdir node_modules
cd node_modules
cd fs-extra
npm install
cd ..
cd ..
npm install
cd ..
cd ..
npm install
cd ..
cd ..
```

To see a demo:

```bash
nvm use 4.4
npm install storage-sync
cd node_modules/storage-sync
npm run dist
cd demo ; python -m SimpleHTTPServer
```

and then visit http://localhost:8000/ and see the console.

To run the tests, run:

````bash
npm install
npm run test
````
