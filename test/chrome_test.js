"use strict";

import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import {StorageChange, StorageChangeEvent, StorageArea} from "../lib/chrome";

chai.use(chaiAsPromised);
chai.should();
chai.config.includeStack = true;


/** @test {StorageChange} */
describe("StorageChange", () => {

  /** @test {StorageChange#constructor} */
  describe("#constructor", () => {
    it("should expose oldValue and newValue", () => {
      const changes = new StorageChange("old", "new");
      expect(changes.oldValue).to.eql("old");
      expect(changes.newValue).to.eql("new");
    });
  });
});


/** @test {StorageChangeEvent} */
describe("StorageChangeEvent", () => {

  /** @test {StorageChangeEvent#constructor} */
  describe("#constructor", () => {
    it("should expose areaName and start with no listeners", () => {
      const changes = new StorageChangeEvent("sync");
      expect(changes.areaName).to.eql("sync");
      expect(changes.listeners).to.eql([]);
    });
  });
});


/** @test {StorageArea} */
describe("StorageArea", () => {

  /** @test {StorageArea#constructor} */
  describe("#constructor", () => {
    it("should expose endpoint and areaName", () => {
      const area = new StorageArea("http://localhost:8080/v1/", "sync");
      expect(area.areaName).to.eql("sync");
      expect(area.endpoint).to.eql("http://localhost:8080/v1/");
    });
  });

  /** @test {StorageArea#set} */
  describe("#set", () => {
    it("set/get a value in IDB", (done) => {
      const area = new StorageArea("http://localhost:8080/v1/", "sync");

      area.set({"something": 1}, function () {
        area.get("something", function(items) {
          expect(items.something).to.eql(1);
          done();
        }).catch(done);
      }).catch(done);
    });

    it("set/remove a value in IDB", (done) => {
      const area = new StorageArea("http://localhost:8080/v1/", "sync");

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
  describe("#get", () => {

    it("get a unexisting keys won't set a attribute", (done) => {
      const area = new StorageArea("http://localhost:8080/v1/", "sync");
      area.get("something", function(items) {
        expect(items.something).to.be.undefined;
            done();
      }).catch(done);
    });

   it("get(null) returns all keys", (done) => {
      const area = new StorageArea("http://localhost:8080/v1/", "sync");

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

});
