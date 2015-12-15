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
      headers: {Authorization: "Basic dXNlcjpwYXNz"},
    });

    function schema() {
      let _next = 0;
      return {
        generate() {
          return _next++;
        },
        validate(id) {
          // validating everything for now
          return true;
        }
      };
    };

    this.items = this.db.collection("items", {idSchema: schema()});

    // XXX just for the tests
    this.items.clear();
  }

  get(keys, callback) {
    keys = [].concat(keys);
    var this_items = this.items;
    var records = [];

    function getRecord(key) {
      console.log("Looking for " + key);

      return this_items.get(key).then(function (res) {
        var promise = new Promise(function(resolve, reject) {
          if (res) {
            records.push(res.data);
            resolve(res.data); 
          } else {
            reject('boom');
          }
        });
        return promise;
      });

    }

    Promise.all(keys.map(key => getRecord(key))).then(
      function() {
        console.log(records);
        if (callback) callback(records);
      }
    );

  }

  getBytesInUse(keys, callback) {
    return 0;
  }

  set(items, callback) {
    items = [].concat(items);
    var this_items = this.items;

    function createItem(item) {
      var record = {'data': Object.values(item)[0]};
      record['id'] = Object.keys(item)[0];
      console.log(record);
      return this_items.create(record, {useRecordId: true});
    }

    Promise.all(items.map(item => createItem(item).then(
              res => { console.log(res.data)}
            ))).then(
      function() {if (callback) callback();}
    );
  }

  remove(keys, callback) {
    keys = [].concat(keys);
    var this_items = this.items;

    function removeItem(key) {
      return this_items.delete(key);
    }

    Promise.all(keys.map(key => removeItem(key).then(
              res => { console.log("deleted " + res.data.id)}
            ))).then(
      function() {if (callback) callback();}
    );
  }

  clear(callback) {
    this.items.clear().then(function() {if (callback) callback();});
  }
}


const storage = {onChanged: new StorageChange(),
                 sync: new StorageArea(),
                 local: new StorageArea(),
                 managed: new StorageArea()};

const chrome = {storage: storage};


