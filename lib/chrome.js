"use strict";

import Kinto from "kinto";
import md5 from "md5";

export class StorageChange {
  constructor(oldValue, newValue) {
    this.oldValue = oldValue;
    this.newValue = newValue;
  }
}

export class StorageChangeEvent {
  constructor(areaName) {
    this.listeners = [];
    this.changes = [];
    this.areaName = areaName;
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    for (let i=0; i<this.listeners.length; i++) {
      if (this.listeners[i] === callback) {
        this.listeners.splice(i, 1);
        break;
      }
    }
  }

  _addChange(key, oldValue, newValue) {
    this.changes[key] = new StorageChange(oldValue, newValue);
  }

  _emit() {
    for (const listener of this.listeners) {
      listener(Object.assign({}, this.changes), this.areaName);
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
    for (const _event in this.events) {
      this.events[_event].addListener(callback);
    }
  }

  removeListener(callback) {
    for (const _event in this.events) {
      this.events[_event].removeListener(callback);
    }
  }

  _addChange(areaName, key, oldValue, newValue) {
    this.events[areaName]._addChange(key, oldValue, newValue);
  }

  _emit(areaName) {
    this.events[areaName]._emit();
  }

}

const MIN_INTERVAL = 1000;

function keyToId(key) {
  let md5Str = md5(key);
  const parts = [];
  [8,4,4,4,12].map(numChars => {
    parts.push(md5Str.substr(0, numChars));
    md5Str = md5Str.substr(numChars);
  });
  return parts.join("-");
}

export class StorageArea {

  constructor(areaName) {
    if (!areaName) {areaName = "sync";}
    this.areaName = areaName;

    this.db = new Kinto();

    this.items = this.db.collection("items");
  }

  get config() {
    return this._config;
  }

  _sync () {
    return this.items.sync({
      remote: this._config.remote,
      headers: this._config.headers
    }).then(syncResults => {
      syncResults.created.map(record => {
        storage.onChanged._addChange(this.areaName, record.key, null, record.data);
      });
      syncResults.updated.map(record => {
        // TODO: work out what the previous version was when a record was updated
        storage.onChanged._addChange(this.areaName, record.key, "unknown", record.data);
      });
      syncResults.deleted.map(record => {
        storage.onChanged._addChange(this.areaName, record.key, record.data, null);
      });
      syncResults.conflicts.map(conflict => {
        storage.onChanged._addChange(this.areaName, conflict.remote.key,
            conflict.local.data, conflict.remote.data);
        this.items.resolve(conflict, conflict.remote);
      });
      storage.onChanged._emit(this.areaName);
    });
  }

  set config(config) {
    if (this.areaName !== "sync") {
      return;
    }
    if (typeof config !== "object") {
      throw new Error("config should be an object");
    }

    this._config = config;

    if (typeof config.interval === "number") {
      if (config.interval < MIN_INTERVAL) {
        throw new Error(`Sync interval should be at least ${MIN_INTERVAL} milliseconds`);
      }

      // Start sync
      if (!this.syncTimer) {
        if (config.type !== "kinto") {
          throw new Error("Unsupported type, try setting chrome.storage.sync.config.type = \"kinto\".");
        }
        this._sync().then(() => {
          this.syncTimer = setInterval(() => {
            this._sync().catch(err => {
              console.error("Sync Error", err.message);
            });
          }, config.interval);
        }, err => {
          console.error("Sync Disabled", err.message);
        });
      }
    } else {
      // Stop sync
      if (this.syncTimer) {
        clearInterval(this.syncTimer);
        delete this.syncTimer;
      }
    }
  }

  get(keys, callback) {
    const this_items = this.items;
    const records = {};

    function getRecord(key) {
      return this_items.get(keyToId(key)).then(function (res) {
        const promise = new Promise(function(resolve, reject) {
          if (res) {
            records[res.data.key] = res.data.data;
            resolve(res.data);
          } else {
            reject("boom");
          }
        });
        return promise;
      },
      function (rejected) {
        // XXX we just swallow the error and not set any key
      }
      );
    }
    function getRecords(keys) {
      return Promise.all(keys.map(key => getRecord(key))).then(
        function() {
          if (callback) {callback(records);}
        }
      );
    }

    if (!keys) {
      keys = [];
      // XXX suboptimal: fetching all ids - then doing a second query
      return this_items.list().then(function(res) {
        res.data.map(r => keys.push(r.key));
      }).then(function() {return getRecords(keys);});
    } else {
      keys = [].concat(keys);
      return getRecords(keys);
    }


  }

  getBytesInUse(keys, callback) {
    callback(0);
  }

  set(items, callback) {
    const this_items = this.items;
    const areaName = this.areaName;

    function createOrUpdateItem(record) {
      function createItem() {
        storage.onChanged._addChange(areaName, record.key, null, record);
        return this_items.create(record, {useRecordId: true});
      }

      function updateItem(old_record) {
        storage.onChanged._addChange(areaName, record.key, old_record, record);
        if (old_record._status === "deleted") {
          return this_items.delete(old_record.id, { virtual: false }).then(() => {
            return this_items.create(record, {useRecordId: true});
          });
        }
        return this_items.update(record);
      }

      return this_items.get(record.id, { includeDeleted: true })
        .then(function(old_record) {
          return updateItem(old_record.data);
        }, function(reason) {
          if (reason.message.indexOf(" not found.") !== -1) {
            return createItem();
          }
          throw reason;
        });
    }

    const promises = [];
    for(const itemId in items) {
      promises.push(createOrUpdateItem({
        id: keyToId(itemId),
        key: itemId,
        data: items[itemId]
      }));
    }
    return Promise.all(promises).then(results => {
      storage.onChanged._emit(areaName);
      if (callback) {callback();}
    });
  }

  remove(keys, callback) {
    keys = [].concat(keys);
    const this_items = this.items;

    function removeItem(key) {
      return this_items.delete(keyToId(key)).catch(err => {
        if (err.message.indexOf(" not found.") !== -1) {
          return;
        }
        throw err;
      });
    }
    return Promise.all(keys.map(removeItem))
      .then(() => {
        if (callback) {
          callback();
        }
      });
  }

  clear(callback) {
    this.items.list()
      .then(records => {
        const promises = records.data.map(record =>
          this.items.delete(record.id));
        return Promise.all(promises);
      }).then(() => {
        if (callback) {
          callback();
        }
      });
  }
}


export const storage = {onChanged: new Events(),
                        sync: new StorageArea("sync"),
                        local: new StorageArea("local"),
                        managed: new StorageArea("managed")};
