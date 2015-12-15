"use strict";


class StorageChange {
  constructor(oldValue, newValue) {
    this.oldValue = oldValue;
    this.newValue = newValue;
  }
}

class StorageChangeEvent {
  constructor(areaName) {
    this.listeners = [];
    this.changes = [];
    this.areaName = areaName;
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  _addChange(key, oldValue, newValue) {
    console.log('adding change event in ' + this.areaName);
    var change = new StorageChange(oldValue, newValue);
    this.changes[key] = change;
  }

  _emit() {
    for (let listener of this.listeners) {
      listener(this.changes, this.areaName)
    }
    this.changes = [];
  }
}

class Events {
  constructor() {
    this.events = {local: new StorageChangeEvent("local"),
                   managed: new StorageChangeEvent("managed"),
                   sync: new StorageChangeEvent("sync")};
  }

  addListener(callback) {

    for (let _event in this.events) {
      this.events[_event].addListener(callback);
     }
  }

  _addChange(areaName, key, oldValue, newValue) {
    this.events[areaName]._addChange(key, oldValue, newValue);
  }

  _emit(areaName) {
    this.events[areaName]._emit();
  }

}


class StorageArea {
  constructor(endpoint, areaName) {
    if (!endpoint) { endpoint = "http://localhost:8080/v1/"};
    this.endpoint = endpoint;

    if (!areaName) { areaName = "sync"};
    this.areaName = areaName;

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
    var areaName = this.areaName;

    function createOrUpdateItem(item) {
      var record = {'data': Object.values(item)[0]};
      var id = Object.keys(item)[0];
      record['id'] = id;
      console.log(record);

      function createItem() {
        console.log('Creating record');
        storage.onChanged._addChange(areaName, id, null, record);
        return this_items.create(record, {useRecordId: true});
      };

      function updateItem(old_record) {
        console.log('Updating record');
        storage.onChanged._addChange(areaName, id, old_record, record);
        return this_items.update(record);
      };

      return this_items.get(id).then(function(old_record) {return updateItem(old_record)}, 
                                     function(reason) {return createItem()});
    }

    Promise.all(items.map(item => createOrUpdateItem(item).then(
              res => { console.log(res.data)}
            ))).then(
      function() {
        storage.onChanged._emit(areaName);
        if (callback) callback();
      }
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


const storage = {onChanged: new Events(),
                 sync: new StorageArea("http://localhost:8080/v1/", "sync"),
                 local: new StorageArea("http://localhost:8080/v1/", "local"),
                 managed: new StorageArea("http://localhost:8080/v1/", "managed")};

const chrome = {storage: storage};


