"use strict";

import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import {StorageChange} from "../lib/chrome";

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
