import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, AbiCoder, keccak256, getBytes, encodeBytes32String } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

interface DogeBridgeContract extends Contract {
  wdoge(): Promise<string>;
  minDeposit(): Promise<bigint>;
  maxDeposit(): Promise<bigint>;
  bridgeFee(): Promise<bigint>;
  processedDeposits(depositId: string): Promise<boolean>;
  processedWithdrawals(withdrawalId: string): Promise<boolean>;
  processDeposit(recipient: string, amount: bigint, depositId: string, signature: string): Promise<any>;
  requestWithdrawal(dogeAddress: string, amount: bigint): Promise<any>;
  updateLimits(minDeposit: bigint, maxDeposit: bigint, bridgeFee: bigint): Promise<any>;
  pause(): Promise<any>;
  unpause(): Promise<any>;
  paused(): Promise<boolean>;
  hasRole(role: string, account: string): Promise<boolean>;
  grantRole(role: string, account: string): Promise<any>;
  revokeRole(role: string, account: string): Promise<any>;
  connect(signer: SignerWithAddress): DogeBridgeContract;
  waitForDeployment(): Promise<this>;
  getAddress(): Promise<string>;
}

interface WDOGEContract extends Contract {
  mint(to: string, amount: bigint): Promise<any>;
  burn(from: string, amount: bigint): Promise<any>;
  balanceOf(account: string): Promise<bigint>;
  approve(spender: string, amount: bigint): Promise<any>;
  setBridge(bridge: string): Promise<any>;
  connect(signer: SignerWithAddress): WDOGEContract;
  waitForDeployment(): Promise<this>;
  getAddress(): Promise<string>;
}

describe("DogeBridge", function () {
  let bridge: DogeBridgeContract;
  let wdoge: WDOGEContract;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let user: SignerWithAddress;
  let signer: SignerWithAddress;
  let testAmount: bigint;

  const minDeposit = ethers.parseEther("1");
  const maxDeposit = ethers.parseEther("1000000");
  const bridgeFee = ethers.parseEther("1");
  const OPERATOR_ROLE = ethers.id("OPERATOR_ROLE");
  const SIGNER_ROLE = ethers.id("SIGNER_ROLE");
  const PREMIUM_USER_ROLE = ethers.id("PREMIUM_USER_ROLE");

  async function signDeposit(
    recipient: string,
    amount: bigint,
    depositId: string,
    signer: SignerWithAddress
  ): Promise<string> {
    const abiCoder = new AbiCoder();
    const encodedData = abiCoder.encode(
      ["address", "uint256", "bytes32"],
      [recipient, amount, depositId]
    );
    const messageHash = keccak256(encodedData);
    const signature = await signer.signMessage(getBytes(messageHash));
    return signature;
  }

  beforeEach(async function () {
    [owner, operator, user, signer] = await ethers.getSigners();
    testAmount = ethers.parseEther("1000");

    // Deploy WDOGE
    const WDOGE = await ethers.getContractFactory("WDOGE", owner);
    wdoge = await WDOGE.deploy() as unknown as WDOGEContract;
    await wdoge.waitForDeployment();
    const wdogeAddress = await wdoge.getAddress();

    // Deploy Bridge
    const DogeBridge = await ethers.getContractFactory("DogeBridge", owner);
    bridge = await DogeBridge.deploy(
      wdogeAddress,
      minDeposit,
      maxDeposit,
      bridgeFee
    ) as unknown as DogeBridgeContract;
    await bridge.waitForDeployment();
    const bridgeAddress = await bridge.getAddress();

    // Set bridge in WDOGE contract
    await wdoge.setBridge(bridgeAddress);

    // Grant roles
    await bridge.grantRole(OPERATOR_ROLE, operator.address);
    await bridge.grantRole(SIGNER_ROLE, signer.address);
  });

  describe("Deployment", function () {
    it("Should set the correct WDOGE address", async function () {
      const bridgeWDOGE = await bridge.wdoge();
      const wdogeAddress = await wdoge.getAddress();
      expect(bridgeWDOGE).to.equal(wdogeAddress);
    });

    it("Should set the correct limits", async function () {
      expect(await bridge.minDeposit()).to.equal(minDeposit);
      expect(await bridge.maxDeposit()).to.equal(maxDeposit);
      expect(await bridge.bridgeFee()).to.equal(bridgeFee);
    });

    it("Should set the deployer as admin and operator", async function () {
      expect(await bridge.hasRole(OPERATOR_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Deposit Processing", function () {
    const depositId = ethers.id("test_deposit");
    const amount = ethers.parseEther("1000");

    it("Should allow operator to process deposit", async function () {
      const signature = await signDeposit(user.address, amount, depositId, signer);
      await bridge.connect(operator).processDeposit(
        user.address,
        amount,
        depositId,
        signature
      );

      expect(await wdoge.balanceOf(user.address)).to.equal(amount);
      expect(await bridge.processedDeposits(depositId)).to.be.true;
    });

    it("Should not allow non-operator to process deposit", async function () {
      const signature = await signDeposit(user.address, amount, depositId, signer);
      await expect(
        bridge.connect(user).processDeposit(
          user.address,
          amount,
          depositId,
          signature
        )
      ).to.be.revertedWith("AccessControl: account 0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc is missing role 0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929");
    });

    it("Should not allow processing same deposit twice", async function () {
      const signature = await signDeposit(user.address, amount, depositId, signer);
      await bridge.connect(operator).processDeposit(
        user.address,
        amount,
        depositId,
        signature
      );

      await expect(
        bridge.connect(operator).processDeposit(
          user.address,
          amount,
          depositId,
          signature
        )
      ).to.be.revertedWith("Deposit already processed");
    });

    it("Should not allow processing deposit below minimum", async function () {
      const belowMin = minDeposit - BigInt(1);
      const signature = await signDeposit(user.address, belowMin, depositId, signer);
      await expect(
        bridge.connect(operator).processDeposit(
          user.address,
          belowMin,
          depositId,
          signature
        )
      ).to.be.revertedWith("Invalid amount");
    });

    it("Should not allow processing deposit above maximum", async function () {
      const aboveMax = maxDeposit + BigInt(1);
      const signature = await signDeposit(user.address, aboveMax, depositId, signer);
      await expect(
        bridge.connect(operator).processDeposit(
          user.address,
          aboveMax,
          depositId,
          signature
        )
      ).to.be.revertedWith("Invalid amount");
    });
  });

  describe("Withdrawal Processing", function () {
    const amount = ethers.parseEther("1000");
    const dogeAddress = "DRtbRTXscM1qWe1zjQSZJxEVryvYgXqkEE";

    beforeEach(async function () {
      // Mint some tokens to user first
      const depositId = ethers.id("initial_deposit");
      const signature = await signDeposit(user.address, amount, depositId, signer);
      await bridge.connect(operator).processDeposit(
        user.address,
        amount,
        depositId,
        signature
      );
      await wdoge.connect(user).approve(await bridge.getAddress(), amount);
    });

    it("Should allow user to request withdrawal", async function () {
      await bridge.connect(user).requestWithdrawal(dogeAddress, amount);

      const timestamp = await time.latest();
      const abiCoder = new AbiCoder();
      const withdrawalId = keccak256(
        abiCoder.encode(
          ["address", "string", "uint256", "uint256"],
          [user.address, dogeAddress, amount, timestamp]
        )
      );

      expect(await bridge.processedWithdrawals(withdrawalId)).to.be.true;
      expect(await wdoge.balanceOf(user.address)).to.equal(0);
    });

    it("Should not allow withdrawal below minimum", async function () {
      await expect(
        bridge.connect(user).requestWithdrawal(dogeAddress, minDeposit - BigInt(1))
      ).to.be.revertedWith("Invalid amount");
    });

    it("Should not allow withdrawal above maximum", async function () {
      await expect(
        bridge.connect(user).requestWithdrawal(dogeAddress, maxDeposit + BigInt(1))
      ).to.be.revertedWith("Invalid amount");
    });

    it("Should not allow withdrawal without sufficient balance", async function () {
      await expect(
        bridge.connect(user).requestWithdrawal(dogeAddress, amount + BigInt(1))
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to update limits", async function () {
      const newMinDeposit = ethers.parseEther("200");
      const newMaxDeposit = ethers.parseEther("2000000");
      const newBridgeFee = ethers.parseEther("2");

      await bridge.updateLimits(newMinDeposit, newMaxDeposit, newBridgeFee);

      expect(await bridge.minDeposit()).to.equal(newMinDeposit);
      expect(await bridge.maxDeposit()).to.equal(newMaxDeposit);
      expect(await bridge.bridgeFee()).to.equal(newBridgeFee);
    });

    it("Should not allow non-admin to update limits", async function () {
      await expect(
        bridge.connect(user).updateLimits(minDeposit, maxDeposit, bridgeFee)
      ).to.be.revertedWith("AccessControl: account 0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");
    });

    it("Should allow admin to pause and unpause", async function () {
      await bridge.pause();
      expect(await bridge.paused()).to.be.true;

      await bridge.unpause();
      expect(await bridge.paused()).to.be.false;
    });

    it("Should not allow operations when paused", async function () {
      const depositId = ethers.id("test_deposit");
      const signature = await signDeposit(user.address, testAmount, depositId, signer);

      await bridge.pause();
      await expect(
        bridge.connect(operator).processDeposit(user.address, testAmount, depositId, signature)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Rate Limiting", function () {
    const depositId = ethers.id("test_deposit");
    const amount = ethers.parseEther("1000");

    beforeEach(async function () {
      await bridge.grantRole(PREMIUM_USER_ROLE, user.address);
    });

    it("Should allow premium users higher transaction limits", async function () {
      for (let i = 0; i < 20; i++) {
        const customDepositId = ethers.id(`test_deposit_${i}`);
        const signature = await signDeposit(user.address, amount, customDepositId, signer);
        await bridge.connect(operator).processDeposit(
          user.address,
          amount,
          customDepositId,
          signature
        );
      }
    });

    it("Should enforce lower limits for standard users", async function () {
      await bridge.revokeRole(PREMIUM_USER_ROLE, user.address);

      for (let i = 0; i < 10; i++) {
        const customDepositId = ethers.id(`test_deposit_${i}`);
        const signature = await signDeposit(user.address, amount, customDepositId, signer);
        await bridge.connect(operator).processDeposit(
          user.address,
          amount,
          customDepositId,
          signature
        );
      }

      const nextDepositId = ethers.id("test_deposit_11");
      const signature = await signDeposit(user.address, amount, nextDepositId, signer);
      await expect(
        bridge.connect(operator).processDeposit(
          user.address,
          amount,
          nextDepositId,
          signature
        )
      ).to.be.revertedWith("Rate limit exceeded");
    });

    it("Should reset rate limits after period expiration", async function () {
      await bridge.revokeRole(PREMIUM_USER_ROLE, user.address);

      // First batch of transactions
      for (let i = 0; i < 10; i++) {
        const customDepositId = ethers.id(`test_deposit_${i}`);
        const signature = await signDeposit(user.address, amount, customDepositId, signer);
        await bridge.connect(operator).processDeposit(
          user.address,
          amount,
          customDepositId,
          signature
        );
      }

      // Move time forward
      await time.increase(3600); // 1 hour

      // Should allow more transactions after reset
      const newDepositId = ethers.id("new_deposit");
      const signature = await signDeposit(user.address, amount, newDepositId, signer);
      await bridge.connect(operator).processDeposit(
        user.address,
        amount,
        newDepositId,
        signature
      );
    });
  });
}); 