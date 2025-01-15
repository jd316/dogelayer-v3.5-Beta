import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

interface WDOGELendingContract extends Contract {
  wdoge(): Promise<string>;
  totalLoaned(): Promise<bigint>;
  totalCollateral(): Promise<bigint>;
  borrow(amount: bigint, collateralAmount: bigint): Promise<any>;
  repay(amount: bigint): Promise<any>;
  addCollateral(amount: bigint): Promise<any>;
  withdrawExcessCollateral(amount: bigint): Promise<any>;
  liquidate(borrower: string): Promise<any>;
  getLoanInfo(borrower: string): Promise<[bigint, bigint, bigint, bigint]>;
  pause(): Promise<any>;
  unpause(): Promise<any>;
  paused(): Promise<boolean>;
  connect(signer: SignerWithAddress): WDOGELendingContract;
  waitForDeployment(): Promise<this>;
  getAddress(): Promise<string>;
}

interface WDOGEContract extends Contract {
  mint(to: string, amount: bigint): Promise<any>;
  approve(spender: string, amount: bigint): Promise<any>;
  balanceOf(account: string): Promise<bigint>;
  connect(signer: SignerWithAddress): WDOGEContract;
  waitForDeployment(): Promise<this>;
  getAddress(): Promise<string>;
}

describe("WDOGELending", function () {
  let lending: WDOGELendingContract;
  let wdoge: WDOGEContract;
  let owner: SignerWithAddress;
  let borrower: SignerWithAddress;
  let liquidator: SignerWithAddress;

  const initialBalance = ethers.parseEther("10000");
  const borrowAmount = ethers.parseEther("1000");
  const collateralAmount = ethers.parseEther("1500"); // 150% collateral ratio

  beforeEach(async function () {
    [owner, borrower, liquidator] = await ethers.getSigners();

    // Deploy WDOGE
    const WDOGE = await ethers.getContractFactory("WDOGE", owner);
    wdoge = (await WDOGE.deploy()) as unknown as WDOGEContract;
    await wdoge.waitForDeployment();
    const wdogeAddress = await wdoge.getAddress();

    // Deploy Lending
    const WDOGELending = await ethers.getContractFactory("WDOGELending", owner);
    lending = (await WDOGELending.deploy(wdogeAddress)) as unknown as WDOGELendingContract;
    await lending.waitForDeployment();
    const lendingAddress = await lending.getAddress();

    // Mint tokens to borrower and liquidator
    await wdoge.mint(borrower.address, initialBalance);
    await wdoge.mint(liquidator.address, initialBalance);

    // Approve lending contract
    await wdoge.connect(borrower).approve(lendingAddress, initialBalance);
    await wdoge.connect(liquidator).approve(lendingAddress, initialBalance);
  });

  describe("Deployment", function () {
    it("Should set the correct WDOGE address", async function () {
      expect(await lending.wdoge()).to.equal(wdoge.address);
    });

    it("Should set the correct constants", async function () {
      const [loanAmount, collateralAmount, interestDue, collateralRatio] = await lending.getLoanInfo(borrower.address);
      expect(loanAmount).to.equal(BigInt(0));
      expect(collateralAmount).to.equal(BigInt(0));
      expect(interestDue).to.equal(BigInt(0));
      expect(collateralRatio).to.equal(BigInt(0));
    });
  });

  describe("Borrowing", function () {
    it("Should allow borrowing with sufficient collateral", async function () {
      await lending.connect(borrower).borrow(borrowAmount, collateralAmount);

      const [loanAmount, collateralAmount_, , collateralRatio] = await lending.getLoanInfo(borrower.address);
      expect(loanAmount).to.equal(borrowAmount);
      expect(collateralAmount_).to.equal(collateralAmount);
      expect(collateralRatio).to.be.gte(BigInt(150)); // 150% minimum ratio
    });

    it("Should not allow borrowing with insufficient collateral", async function () {
      const insufficientCollateral = ethers.parseEther("1000"); // 100% collateral
      await expect(
        lending.connect(borrower).borrow(borrowAmount, insufficientCollateral)
      ).to.be.revertedWith("Insufficient collateral");
    });

    it("Should not allow borrowing with existing loan", async function () {
      await lending.connect(borrower).borrow(borrowAmount, collateralAmount);

      await expect(
        lending.connect(borrower).borrow(borrowAmount, collateralAmount)
      ).to.be.revertedWith("Existing loan must be repaid first");
    });
  });

  describe("Repayment", function () {
    beforeEach(async function () {
      await lending.connect(borrower).borrow(borrowAmount, collateralAmount);
    });

    it("Should allow full repayment with interest", async function () {
      // Move time forward to accumulate interest
      await time.increase(365 * 24 * 60 * 60); // 1 year

      const [loanAmount, , interestDue] = await lending.getLoanInfo(borrower.address);
      const totalDue = loanAmount + interestDue;

      await lending.connect(borrower).repay(totalDue);

      const [newLoanAmount] = await lending.getLoanInfo(borrower.address);
      expect(newLoanAmount).to.equal(BigInt(0));
    });

    it("Should allow partial repayment", async function () {
      const repayAmount = borrowAmount / BigInt(2);
      await lending.connect(borrower).repay(repayAmount);

      const [loanAmount] = await lending.getLoanInfo(borrower.address);
      expect(loanAmount).to.equal(borrowAmount - repayAmount);
    });

    it("Should not allow repaying more than owed", async function () {
      const tooMuch = borrowAmount * BigInt(2);
      await expect(
        lending.connect(borrower).repay(tooMuch)
      ).to.be.revertedWith("Amount exceeds loan + interest");
    });
  });

  describe("Collateral Management", function () {
    beforeEach(async function () {
      await lending.connect(borrower).borrow(borrowAmount, collateralAmount);
    });

    it("Should allow adding collateral", async function () {
      const additionalCollateral = ethers.parseEther("500");
      await lending.connect(borrower).addCollateral(additionalCollateral);

      const [, newCollateral] = await lending.getLoanInfo(borrower.address);
      expect(newCollateral).to.equal(collateralAmount + additionalCollateral);
    });

    it("Should allow withdrawing excess collateral", async function () {
      const excessAmount = ethers.parseEther("200");
      await lending.connect(borrower).withdrawExcessCollateral(excessAmount);

      const [, newCollateral] = await lending.getLoanInfo(borrower.address);
      expect(newCollateral).to.equal(collateralAmount - excessAmount);
    });

    it("Should not allow withdrawing too much collateral", async function () {
      const tooMuch = ethers.parseEther("1000");
      await expect(
        lending.connect(borrower).withdrawExcessCollateral(tooMuch)
      ).to.be.revertedWith("Insufficient excess collateral");
    });
  });

  describe("Liquidation", function () {
    beforeEach(async function () {
      await lending.connect(borrower).borrow(borrowAmount, collateralAmount);
    });

    it("Should allow liquidation when undercollateralized", async function () {
      // Move time forward to accumulate interest and reduce collateral ratio
      await time.increase(365 * 24 * 60 * 60); // 1 year

      const liquidatorBalanceBefore = await wdoge.balanceOf(liquidator.address);
      await lending.connect(liquidator).liquidate(borrower.address);
      const liquidatorBalanceAfter = await wdoge.balanceOf(liquidator.address);

      // Liquidator should receive collateral
      expect(liquidatorBalanceAfter).to.be.gt(liquidatorBalanceBefore);

      // Loan should be cleared
      const [loanAmount] = await lending.getLoanInfo(borrower.address);
      expect(loanAmount).to.equal(BigInt(0));
    });

    it("Should not allow liquidation when sufficiently collateralized", async function () {
      await expect(
        lending.connect(liquidator).liquidate(borrower.address)
      ).to.be.revertedWith("Loan not liquidatable");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to pause and unpause", async function () {
      await lending.pause();
      expect(await lending.paused()).to.be.true;

      await lending.unpause();
      expect(await lending.paused()).to.be.false;
    });

    it("Should not allow borrowing when paused", async function () {
      await lending.pause();
      await expect(
        lending.connect(borrower).borrow(borrowAmount, collateralAmount)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should still allow repayment when paused", async function () {
      await lending.connect(borrower).borrow(borrowAmount, collateralAmount);
      await lending.pause();

      // Should not revert
      await lending.connect(borrower).repay(borrowAmount);
    });
  });
}); 