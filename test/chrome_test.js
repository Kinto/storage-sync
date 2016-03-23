"use strict";

import chai, { expect } from "chai";
import btoa from "btoa";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import {StorageChange, StorageChangeEvent, StorageArea, storage} from "../lib/chrome";

chai.use(chaiAsPromised);
chai.should();
chai.config.includeStack = true;


/** @test {StorageChange} */
describe("StorageChange", function() {

  /** @test {StorageChange#constructor} */
  describe("#constructor", function() {
    it("should expose oldValue and newValue", function() {
      const changes = new StorageChange("old", "new");
      expect(changes.oldValue).to.eql("old");
      expect(changes.newValue).to.eql("new");
    });
  });
});


/** @test {StorageChangeEvent} */
describe("StorageChangeEvent", function() {
  let changes;

  beforeEach(function() {
    changes = new StorageChangeEvent("sync");
  });

  /** @test {StorageChangeEvent#constructor} */
  describe("#constructor", function() {
    it("should expose areaName and start with no listeners", function() {
      expect(changes.areaName).to.eql("sync");
      expect(changes.listeners).to.eql([]);
    });
  });

  /** @test {StorageChangeEvent#constructor} */
  describe("addListener", function() {
    it("should add the listener", function() {
      const listener = function() { return "foo"; };
      changes.addListener(listener);
      expect(changes.listeners).to.deep.eql([listener]);
    });
  });

  /** @test {StorageChangeEvent#constructor} */
  describe("removeListener", function() {
    const listener1 = function() { return "foo"; };
    const listener2 = function() { return "bar"; };

    beforeEach(function() {
      changes.addListener(listener1);
      changes.addListener(listener2);
    });

    it("should remove the listener (1)", function() {
      changes.removeListener(listener1);
      expect(changes.listeners).to.deep.eql([listener2]);
    });

    it("should remove the listener (2)", function() {
      changes.removeListener(listener2);
      expect(changes.listeners).to.deep.eql([listener1]);
    });
  });
});


/** @test {StorageArea} */
describe("StorageArea", function() {
  const area = new StorageArea("sync");
  let sandbox, consoleSpy, syncStub, syncResults, changeSpy;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    consoleSpy = sandbox.spy(console, "error");
    syncStub = sandbox.stub(area.items, "sync", function() {
      return Promise.resolve(syncResults);
    });
    changeSpy = sandbox.spy();
    storage.onChanged.addListener(changeSpy);

    syncResults = {
      created: [],
      updated: [],
      deleted: [],
      conflicts: [],
      ok: true
    };
  });

  afterEach(function(done) {
    storage.onChanged.removeListener(changeSpy);
    sandbox.restore();
    area.items.clear().then(() => done(), done);
  });

  /** @test {StorageArea#constructor} */
  describe("#constructor", function() {
    it("should expose areaName", function() {
      expect(area.areaName).to.eql("sync");
    });
  });

  describe(".config setter", function() {
    it("should set the config", function() {
      area.config = { type: "kinto", remote: "http://localhost:8080/v1/" };
      expect(area.config.remote).to.eql("http://localhost:8080/v1/");
    });

    it("should configure a sync timer", function(done) {
      area.config = {
        type: "kinto",
        interval: 123000,
        remote: "https://foo.com/",
        headers: {
          Authorization: "Basic " + btoa("testuser:s3cr3t")
        }
      };
      setTimeout(function() {
        expect(consoleSpy.called).to.eql(false);
        expect(syncStub.calledWith({
          remote: "https://foo.com/",
          headers: {
            Authorization: "Basic dGVzdHVzZXI6czNjcjN0"
          }
        })).to.eql(true);
        expect(area.syncTimer._idleTimeout).to.eql(123000);
        area.config = {};
        done();
      }); // give time for call to stubbed sync method to complete
    });

    it("checks config is an object", function() {
      expect(function() {
        area.config = 42;
      }).to.Throw(Error, "config should be an object");
      expect(syncStub.called).to.eql(false);
    });

    it("checks type equals \"kinto\"", function() {
      expect(function() {
        area.config = { type: "foo", interval: 123000 };
      }).to.Throw(Error, /Unsupported type/);
      expect(syncStub.called).to.eql(false);
    });

    it("checks MIN_INTERVAL of 1000ms", function() {
      expect(function() {
        area.config = { type: "kinto", interval: 123 };
      }).to.Throw(Error, /at least 1000/);
      expect(syncStub.called).to.eql(false);
    });
  });

  /** @test {StorageArea#set} */
  describe("#set", function() {
    beforeEach(function(done) {
      area.set({"something": 1}, done);
    });

    it("set/get a value in IDB", function(done) {
      area.get("something", function(items) {
        expect(items.something).to.eql(1);
        done();
      });
    });

    it("set id, key, and data", function(done) {
      area.items.list({}, { includeDeleted: true }).then(arr => {
        expect(arr).to.deep.eql({
          data: [
            {
              id: "437b930d-b84b-8079-c2dd-804a71936b5f",
              key: "something",
              data: 1,
              _status: "created"
            }
          ],
          permissions: {}
        });
        done();
      });
    });

    it("set/remove a value in IDB", function(done) {
      area.remove("something", function() {
        area.get("something", function(items) {
          expect(items.something).to.be.undefined;
          done();
        });
      });
    });

    it("can set a previously removed record", function(done) {
      area.remove("something", function() {
        area.set({"something": 2}, function() {
          area.get(null, function(items) {
            expect(items).to.deep.eql({ something: 2 });
            done();
          });
        });
      });
    });

    it("triggers a change event", function() {
      expect(changeSpy.args[0]).to.deep.eql([{
        something: {
          oldValue: undefined,
          newValue: 1
        }
      }, "sync" ]);
    });
  });

  /** @test {StorageArea#get} */
  describe("#get", function() {

    it("get a unexisting keys won't set a attribute", function(done) {
      area.get("something", function(items) {
        expect(items).to.deep.eql({});
        done();
      });
    });

    it("get(null) returns all keys", function(done) {
      area.set({"something": 1}, function () {
        area.set({"else": 2}, function () {
          area.get(null, function(items) {
            expect(items.something).to.eql(1);
            expect(items.else).to.eql(2);
            done();
          });
        });
      });
    });

  });

  /** @test {StorageArea#getBytesInUse} */
  describe("#getBytesInUse", function() {

    it("returns 0", function(done) {
      area.getBytesInUse(null, function(inUse) {
        expect(inUse).to.eql(0);
        done();
      });
    });
  });

  /** @test {StorageArea#remove} */
  describe("#remove", function() {
    it("removes a single entry", function(done) {
      area.set({ foo: "bar" }, function() {
        area.remove("foo", function() {
          area.get("foo", function(items) {
            expect(items).to.deep.eql({});
            done();
          });
        });
      });
    });

    it("silently ignores a missing entry", function(done) {
      area.remove("nonexisting", function() {
        done();
      });
    });

    it("does not remove other entries", function(done) {
      area.set({ foo: "bar", baz: "bar" }, function() {
        area.remove("baz", function() {
          area.get("foo", function(items) {
            expect(items.foo).to.eql("bar");
            done();
          });
        });
      });
    });

    it("removes an array of keys", function(done) {
      area.set({ foo: "bar", baz: "bar" }, function() {
        area.remove(["foo", "baz"], function() {
          area.get(["foo", "baz"], function(items) {
            expect(items).to.deep.eql({});
            done();
          });
        });
      });
    });

    it("treats the callback parameter as optional", function(done) {
      const spy = sandbox.spy(area.items, "delete");

      area.set({ foo: "bar" }, function() {
        area.remove(["foo"]);
        setTimeout(function() {
          expect(spy.calledWith("acbd18db-4cc2-f85c-edef-654fccc4a4d8")).to.eql(true);
          done();
        });
      });
    });

    it("triggers a change event", function() {
      area.set({ foo: "bar" }, function() {
        area.remove("foo", function() {
          expect(changeSpy.args[1]).to.deep.eql([{
            something: {
              oldValue: undefined,
              newValue: 1
            }
          }, "sync" ]);
        });
      });
    });
  });

  /** @test {StorageArea#clear} */
  describe("#clear", function() {
    beforeEach(function(done) {
      area.set({ foo: "bar", baz: "bar" }, function() {
        area.clear(function() {
          done();
        });
      });
    });

    it("deletes all records", function(done) {
      area.get(null, function(items) {
        expect(items).to.deep.eql({});
        done();
      });
    });

    it("only deletes records virtually", function(done) {
      area.items.list({}, { includeDeleted: true }).then(arr => {
        expect(arr).to.deep.eql({
          data: [
            {
              id: "73feffa4-b7f6-bb68-e44c-f984c85f6e88",
              key: "baz",
              data: "bar",
              _status: "deleted"
            },
            {
              id: "acbd18db-4cc2-f85c-edef-654fccc4a4d8",
              key: "foo",
              data: "bar",
              _status: "deleted"
            }
          ],
          permissions: {}
        });
        done();
      });
    });

    it("triggers change events", function() {
      expect(changeSpy.args[1]).to.deep.eql([{
        foo: {
          oldValue: "bar",
          newValue: undefined
        },
        baz: {
          oldValue: "bar",
          newValue: undefined
        }
      }, "sync" ]);
    });
  });

  describe("sync process", function() {
    beforeEach(function() {
      area.config = {
        type: "kinto",
        interval: 123000,
        headers: {
          Authorization: "Basic " + btoa("testuser:s3cr3t")
        }
      };
    });

    afterEach(function() {
      storage.onChanged.removeListener(changeSpy);
      area.config = {};
    });

    it("fires events for created records", function(done) {
      syncResults.created = [{
        id: "acbd18db-4cc2-f85c-edef-654fccc4a4d8",
        key: "foo",
        data: "bar"
      }];
      setTimeout(function() {
        expect(changeSpy.args[0]).to.deep.eql([
          {
            foo: {
              oldValue: null,
              newValue: "bar"
            }
          },
          "sync"
        ]);
        done();
      }); // give time for call to stubbed sync method to complete
    });

    it("fires events for updated records", function(done) {
      syncResults.updated = [{
        id: "acbd18db-4cc2-f85c-edef-654fccc4a4d8",
        key: "foo",
        data: "bar"
      }];
      setTimeout(function() {
        expect(changeSpy.args[0]).to.deep.eql([
          {
            foo: {
              oldValue: "unknown",
              newValue: "bar"
            }
          },
          "sync"
        ]);
        done();
      }); // give time for call to stubbed sync method to complete
    });

    it("fires events for deleted records", function(done) {
      syncResults.deleted = [{
        id: "acbd18db-4cc2-f85c-edef-654fccc4a4d8",
        key: "foo",
        data: "bar"
      }];
      setTimeout(function() {
        expect(changeSpy.args[0]).to.deep.eql([
          {
            foo: {
              oldValue: "bar",
              newValue: null
            }
          },
          "sync"
        ]);
        done();
      }); // give time for call to stubbed sync method to complete
    });

    it("resolves conflicts by letting server win", function(done) {
      syncResults.conflicts = [{
        local: {
          id: "acbd18db-4cc2-f85c-edef-654fccc4a4d8",
          key: "foo",
          data: "bar"
        },
        remote: {
          id: "acbd18db-4cc2-f85c-edef-654fccc4a4d8",
          key: "foo",
          data: "baz"
        }
      }];
      setTimeout(function() {
        expect(changeSpy.args[0]).to.deep.eql([
          {
            foo: {
              oldValue: "bar",
              newValue: "baz"
            }
          },
          "sync"
        ]);
        done();
      }); // give time for call to stubbed sync method to complete
    });
  });
});
