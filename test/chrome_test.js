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
    it("should set a value in IDB", (done) => {
      const area = new StorageArea("http://localhost:8080/v1/", "sync");
      console.log("bla");
      /*
	  area.set({"something": 1}, function () {
        area.get("OK", function(res) {
          expect(res).to.eql({"something": 1});
          done();
        });
      });
	  */
      area.set({"something": 1}, function() {
        done();
      })
      .catch(done);
    });
  });

});
