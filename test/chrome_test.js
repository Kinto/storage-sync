"use strict";

import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import {StorageChange, StorageChangeEvent, StorageArea} from "../lib/chrome";

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
  const area = new StorageArea("http://localhost:8080/v1/", "sync");

  afterEach(function(done) {
    area.clear(done);
  });

  /** @test {StorageArea#constructor} */
  describe("#constructor", function() {
    it("should expose endpoint and areaName", function() {
      expect(area.areaName).to.eql("sync");
      expect(area.endpoint).to.eql("http://localhost:8080/v1/");
    });
  });

  /** @test {StorageArea#set} */
  describe("#set", function() {
    it("set/get a value in IDB", function(done) {
      area.set({"something": 1}, function () {
        area.get("something", function(items) {
          expect(items.something).to.eql(1);
          done();
        }).catch(done);
      }).catch(done);
    });

    it("set/remove a value in IDB", function(done) {
      area.set({"something": 1}, function () {
        area.remove("something", function() {
          area.get("something", function(items) {
            expect(items.something).to.be.undefined;
            done();
          }).catch(done);
        }).catch(done);
      }).catch(done);
    });


  });

  /** @test {StorageArea#get} */
  describe("#get", function() {

    it("get a unexisting keys won't set a attribute", function(done) {
      area.get("something", function(items) {
        expect(items.something).to.be.undefined;
            done();
      }).catch(done);
    });

   it("get(null) returns all keys", function(done) {
      area.set({"something": 1}, function () {
        area.set({"else": 2}, function () {
          area.get(null, function(items) {
            expect(items.something).to.eql(1);
            expect(items.else).to.eql(2);
            done();
          }).catch(done);
        }).catch(done);
      }).catch(done);

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

});
