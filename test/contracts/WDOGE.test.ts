import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

interface WDOGEContract extends Contract {
  owner(): Promise<string>;
  bridge(): Promise<string>;
  name(): Promise<string>;
  symbol(): Promise<string>;
  setBridge(address: string): Promise<any>;
  mint(to: string, amount: bigint): Promise<any>;
  burn(from: string, amount: bigint): Promise<any>;
  balanceOf(account: string): Promise<bigint>;
  pause(): Promise<any>;
  unpause(): Promise<any>;
  paused(): Promise<boolean>;
  transfer(to: string, amount: bigint): Promise<any>;
  connect(signer: SignerWithAddress): WDOGEContract;
  waitForDeployment(): Promise<this>;
  getAddress(): Promise<string>;
}

describe("WDOGE", function () {
  let wdoge: WDOGEContract;
  let owner: SignerWithAddress;
  let bridge: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    [owner, bridge, user] = await ethers.getSigners();

    const WDOGE = await ethers.getContractFactory("WDOGE", owner);
    wdoge = await WDOGE.deploy() as unknown as WDOGEContract;
    await wdoge.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await wdoge.owner()).to.equal(owner.address);
    });

    it("Should set the deployer as initial bridge", async function () {
      expect(await wdoge.bridge()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      expect(await wdoge.name()).to.equal("Wrapped Dogecoin");
      expect(await wdoge.symbol()).to.equal("wDOGE");
    });
  });

  describe("Bridge Management", function () {
    it("Should allow owner to set bridge address", async function () {
      await wdoge.setBridge(bridge.address);
      expect(await wdoge.bridge()).to.equal(bridge.address);
    });

    it("Should not allow non-owner to set bridge address", async function () {
      await expect(
        wdoge.connect(user).setBridge(bridge.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow setting bridge to zero address", async function () {
      await expect(
        wdoge.setBridge("0x0000000000000000000000000000000000000000")
      ).to.be.revertedWith("Invalid bridge address");
    });
  });

  describe("Minting", function () {
    beforeEach(async function () {
      await wdoge.setBridge(bridge.address);
    });

    it("Should allow bridge to mint tokens", async function () {
      const amount = ethers.parseEther("100");
      await wdoge.connect(bridge).mint(user.address, amount);
      expect(await wdoge.balanceOf(user.address)).to.equal(amount);
    });

    it("Should not allow non-bridge to mint tokens", async function () {
      const amount = ethers.parseEther("100");
      await expect(
        wdoge.connect(user).mint(user.address, amount)
      ).to.be.revertedWith("Only bridge can mint");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await wdoge.setBridge(bridge.address);
      await wdoge.connect(bridge).mint(user.address, ethers.parseEther("100"));
    });

    it("Should allow bridge to burn tokens", async function () {
      const amount = ethers.parseEther("50");
      await wdoge.connect(bridge).burn(user.address, amount);
      expect(await wdoge.balanceOf(user.address)).to.equal(ethers.parseEther("50"));
    });

    it("Should not allow non-bridge to burn tokens", async function () {
      const amount = ethers.parseEther("50");
      await expect(
        wdoge.connect(user).burn(user.address, amount)
      ).to.be.revertedWith("Only bridge can burn");
    });
  });

  describe("Pausing", function () {
    beforeEach(async function () {
      await wdoge.setBridge(bridge.address);
      await wdoge.connect(bridge).mint(user.address, ethers.parseEther("100"));
    });

    it("Should allow owner to pause and unpause", async function () {
      await wdoge.pause();
      expect(await wdoge.paused()).to.be.true;

      await wdoge.unpause();
      expect(await wdoge.paused()).to.be.false;
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(
        wdoge.connect(user).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should prevent transfers when paused", async function () {
      await wdoge.pause();
      await expect(
        wdoge.connect(user).transfer(bridge.address, ethers.parseEther("50"))
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow transfers when unpaused", async function () {
      await wdoge.pause();
      await wdoge.unpause();
      
      const amount = ethers.parseEther("50");
      await wdoge.connect(user).transfer(bridge.address, amount);
      expect(await wdoge.balanceOf(bridge.address)).to.equal(amount);
    });
  });
}); 