"use strict";


class StorageChange {
  constructor() {}

  addListener(callback) {
  }
}


class StorageArea {
  constructor(endpoint) {
    if (!endpoint) { endpoint = "http://localhost:8080/v1/"};
    this.endpoint = endpoint;

    this.db = new Kinto({
      remote: endpoint,
      headers: {Authorization: "Basic dXNlcjpwYXNz"}
    });

    this.items = this.db.collection("items");

  }

  get(keys, callback) {
    // todo: implement the list of keys.
    return this.items.get(keys);
  }

  getBytesInUse(keys, callback) {
    return 0;
  }

  set(items, callback) {
    items = [].concat(items);

    Promise.all(items.map(this.items.create)).then(
      function() {if (callback) callback();}
    );
  }

  remove(keys, callback) {
    this.items.delete(keys);
  }

  clear(callback) {
    this.items.clear();
  }
}


const storage = {onChanged: new StorageChange(),
                 sync: new StorageArea(),
                 local: new StorageArea(),
                 managed: new StorageArea()};

