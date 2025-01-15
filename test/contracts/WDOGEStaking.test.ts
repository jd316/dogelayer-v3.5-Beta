import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

interface WDOGEStakingContract extends Contract {
  wdoge(): Promise<string>;
  rewardRate(): Promise<bigint>;
  stake(amount: bigint): Promise<any>;
  unstake(amount: bigint): Promise<any>;
  claimReward(): Promise<any>;
  getStakeInfo(user: string): Promise<[bigint, bigint]>;
  setRewardRate(newRate: bigint): Promise<any>;
  pause(): Promise<any>;
  unpause(): Promise<any>;
  paused(): Promise<boolean>;
  connect(signer: SignerWithAddress): WDOGEStakingContract;
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

describe("WDOGEStaking", function () {
  let staking: WDOGEStakingContract;
  let wdoge: WDOGEContract;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let other: SignerWithAddress;

  const initialBalance = ethers.parseEther("1000");
  const stakeAmount = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, user, other] = await ethers.getSigners();

    // Deploy WDOGE
    const WDOGE = await ethers.getContractFactory("WDOGE", owner);
    wdoge = (await WDOGE.deploy()) as unknown as WDOGEContract;
    await wdoge.waitForDeployment();
    const wdogeAddress = await wdoge.getAddress();

    // Deploy Staking
    const WDOGEStaking = await ethers.getContractFactory("WDOGEStaking", owner);
    staking = (await WDOGEStaking.deploy(wdogeAddress)) as unknown as WDOGEStakingContract;
    await staking.waitForDeployment();
    const stakingAddress = await staking.getAddress();

    // Mint tokens to user and staking contract
    await wdoge.mint(user.address, initialBalance);
    await wdoge.mint(stakingAddress, ethers.parseEther("10000")); // Mint tokens for rewards
    await wdoge.connect(user).approve(stakingAddress, initialBalance);
  });

  describe("Deployment", function () {
    it("Should set the correct WDOGE address", async function () {
      const wdogeAddress = await wdoge.getAddress();
      expect(await staking.wdoge()).to.equal(wdogeAddress);
    });

    it("Should set the correct reward rate", async function () {
      expect(await staking.rewardRate()).to.equal(BigInt(100)); // 1% annual rate
    });
  });

  describe("Staking", function () {
    it("Should allow users to stake tokens", async function () {
      await staking.connect(user).stake(stakeAmount);
      const [stakedAmount] = await staking.getStakeInfo(user.address);
      expect(stakedAmount).to.equal(stakeAmount);
    });

    it("Should not allow staking zero amount", async function () {
      await expect(
        staking.connect(user).stake(BigInt(0))
      ).to.be.revertedWith("Cannot stake 0");
    });

    it("Should not allow staking without sufficient balance", async function () {
      await expect(
        staking.connect(other).stake(stakeAmount)
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });
  });

  describe("Rewards", function () {
    beforeEach(async function () {
      await staking.connect(user).stake(stakeAmount);
    });

    it("Should accumulate rewards over time", async function () {
      // Move time forward by 1 year
      await time.increase(365 * 24 * 60 * 60);

      const [, pendingRewards] = await staking.getStakeInfo(user.address);
      const expectedRewards = (stakeAmount * BigInt(100)) / BigInt(10000); // 1% annual rate
      expect(pendingRewards).to.equal(expectedRewards);
    });

    it("Should allow claiming rewards", async function () {
      // Move time forward
      await time.increase(365 * 24 * 60 * 60);

      const balanceBefore = await wdoge.balanceOf(user.address);
      await staking.connect(user).claimReward();
      const balanceAfter = await wdoge.balanceOf(user.address);

      const [, pendingRewards] = await staking.getStakeInfo(user.address);
      expect(pendingRewards).to.equal(BigInt(0));
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should update rewards when staking more", async function () {
      // Move time forward
      await time.increase(180 * 24 * 60 * 60); // 6 months

      // Stake more
      await staking.connect(user).stake(stakeAmount);

      const [stakedAmount, pendingRewards] = await staking.getStakeInfo(user.address);
      expect(stakedAmount).to.equal(stakeAmount * BigInt(2));
      expect(pendingRewards).to.be.gt(BigInt(0));
    });
  });

  describe("Unstaking", function () {
    beforeEach(async function () {
      await staking.connect(user).stake(stakeAmount);
    });

    it("Should allow users to unstake tokens", async function () {
      await staking.connect(user).unstake(stakeAmount);
      const [stakedAmount] = await staking.getStakeInfo(user.address);
      expect(stakedAmount).to.equal(BigInt(0));
    });

    it("Should not allow unstaking zero amount", async function () {
      await expect(
        staking.connect(user).unstake(BigInt(0))
      ).to.be.revertedWith("Cannot unstake 0");
    });

    it("Should not allow unstaking more than staked", async function () {
      await expect(
        staking.connect(user).unstake(stakeAmount + BigInt(1))
      ).to.be.revertedWith("Insufficient stake");
    });

    it("Should claim rewards when unstaking", async function () {
      // Move time forward
      await time.increase(365 * 24 * 60 * 60);

      const balanceBefore = await wdoge.balanceOf(user.address);
      await staking.connect(user).unstake(stakeAmount);
      const balanceAfter = await wdoge.balanceOf(user.address);

      expect(balanceAfter).to.be.gt(balanceBefore + stakeAmount);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set reward rate", async function () {
      const newRate = BigInt(200); // 2% annual rate
      await staking.setRewardRate(newRate);
      expect(await staking.rewardRate()).to.equal(newRate);
    });

    it("Should not allow non-owner to set reward rate", async function () {
      await expect(
        staking.connect(user).setRewardRate(BigInt(200))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow setting rate too high", async function () {
      await expect(
        staking.setRewardRate(BigInt(1001)) // > 10%
      ).to.be.revertedWith("Rate too high");
    });

    it("Should allow owner to pause and unpause", async function () {
      await staking.pause();
      expect(await staking.paused()).to.be.true;

      await staking.unpause();
      expect(await staking.paused()).to.be.false;
    });

    it("Should not allow staking when paused", async function () {
      await staking.pause();
      await expect(
        staking.connect(user).stake(stakeAmount)
      ).to.be.revertedWith("Pausable: paused");
    });
  });
}); 