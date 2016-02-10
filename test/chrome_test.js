"use strict";

import chai, { expect } from "chai";
import Kinto from "kinto";
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

  /** @test {StorageChangeEvent#constructor} */
  describe("#constructor", function() {
    it("should expose areaName and start with no listeners", function() {
      const changes = new StorageChangeEvent("sync");
      expect(changes.areaName).to.eql("sync");
      expect(changes.listeners).to.eql([]);
    });
  });
});


/** @test {StorageArea} */
describe("StorageArea", function() {
  const area = new StorageArea("sync");
  let sandbox, consoleSpy, syncStub, syncResults;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    consoleSpy = sandbox.spy(console, "error");
    syncStub = sandbox.stub(area.items, "sync", function() {
      return Promise.resolve(syncResults);
    });

    syncResults = {
      created: [],
      updated: [],
      deleted: [],
      conflicts: [],
      ok: true
    };
  });

  afterEach(function(done) {
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
        clearInterval(area.syncTimer);
        done();
      }); // give time for call to stubbed sync method to complete
    });

    it("should respect MIN_INTERVAL of 1000ms", function(done) {
      area.config = { type: "kinto", interval: 123 };
      expect(consoleSpy
          .calledWith("Sync interval should be at least 1000 milliseconds"))
          .to.eql(true);
      expect(syncStub.called).to.eql(false);
      done();
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
             id: '437b930d-b84b-8079-c2dd-804a71936b5f',
             key: 'something',
             data: 1,
             _status: 'created'
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
    })
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
        expect(spy.calledWith("acbd18db-4cc2-f85c-edef-654fccc4a4d8")).to.eql(true);
        done();
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
             id: '73feffa4-b7f6-bb68-e44c-f984c85f6e88',
             key: 'baz',
             data: 'bar',
             _status: 'deleted'
           },
           {
             id: 'acbd18db-4cc2-f85c-edef-654fccc4a4d8',
             key: 'foo',
             data: 'bar',
             _status: 'deleted'
           }
         ],
          permissions: {}
        });
        done();
      });
    });
  });

  describe("sync process", function() {
    let changeSpy;

    beforeEach(function() {
      //TODO: make this nicer once https://github.com/Kinto/kinto-chrome/issues/20
      //is fixed:
      if (changeSpy) {
        changeSpy.reset();
      } else {
        changeSpy = sinon.spy();
        storage.onChanged.addListener(changeSpy);
      }

      area.config = {
        type: "kinto",
        interval: 123000,
        headers: {
          Authorization: "Basic " + btoa("testuser:s3cr3t")
        }
      };
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
