const { messagePrefix } = require("@ethersproject/hash");
const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("Exchange Contract", () => {
  let token;
  let exchange;
  let feeAccount;
  const ETHER_ADDRESS = ethers.constants.AddressZero;
  const feePercent = 10;

  beforeEach(async () => {
    [deployer, feeAccount, bob] = await ethers.getSigners();
    const Token = await ethers.getContractFactory('Token');
    token = await Token.deploy('Gemcoin', 'GEM', 18, ethers.utils.parseEther('1000'));
    await token.deployed();

    const Exchange = await ethers.getContractFactory('Exchange');
    exchange = await Exchange.deploy(feeAccount.address, feePercent);
    await exchange.deployed();
  });

  describe("feeAccount", () => {
    it("returns the fee account", async () => {
      expect(await exchange.feeAccount()).to.equal(feeAccount.address)
    });

    it("returns the fee percentage", async () => {
      expect(await exchange.feePercent()).to.equal(10);
    });
  });

  describe("depositEther", () => {
    it("deposits ether to the contract address", async () => {
      await exchange.connect(bob).depositEther({ value: ethers.utils.parseEther('1') });
      expect(await exchange.tokens(ETHER_ADDRESS, bob.address)).to.equal(ethers.utils.parseEther('1'));
    });

    it("fire 'Deposit' event when successfuly deposit ether", async () => {
      const depositEtherTx = await exchange.connect(bob).depositEther({ value: ethers.utils.parseEther('1') });
      await expect(depositEtherTx).to.emit(exchange, 'Deposit').withArgs(ETHER_ADDRESS, bob.address, ethers.utils.parseEther('1'), ethers.utils.parseEther('1'));
    });
  });

  describe("withdrawEther", () => {
    it("withdraws ether to the caller address", async () => {
      await exchange.connect(bob).depositEther({ value: ethers.utils.parseEther('3') });
      await exchange.connect(bob).withdrawEther(ethers.utils.parseEther('1'));
      expect(await exchange.tokens(ETHER_ADDRESS, bob.address)).to.equal(ethers.utils.parseEther('2'));
    });

    it("fire 'Withdraw' event when successfully withdraw ETHER", async () => {
      await exchange.connect(bob).depositEther({ value: ethers.utils.parseEther('3') });
      const withdrawEtherTx = await exchange.connect(bob).withdrawEther(ethers.utils.parseEther('1'));
      await expect(withdrawEtherTx).to.emit(exchange, 'Withdraw').withArgs(ETHER_ADDRESS, bob.address, ethers.utils.parseEther('1'), ethers.utils.parseEther('2'));
    });

    it("throws when withdraw more ETHER than owned", async () => {
      const withdrawEtherTx = exchange.connect(bob).withdrawEther(ethers.utils.parseEther('1'));
      await expect(withdrawEtherTx).to.be.revertedWith("Not enough ETHER");
    });
  });

  describe("depositToken", () => {
    it("deposits the token to the contract address", async () => {
      await token.transfer(bob.address, ethers.utils.parseEther('100'));
      await token.connect(bob).approve(exchange.address, ethers.utils.parseEther('100'));
      await exchange.connect(bob).depositToken(token.address, ethers.utils.parseEther('100'));

      expect(await token.balanceOf(exchange.address)).to.equal(ethers.utils.parseEther('100'));
      expect(await exchange.tokens(token.address, bob.address)).to.equal(ethers.utils.parseEther('100'));
    });

    it("fire 'Deposit' event when successfully deposit token", async () => {
      await token.transfer(bob.address, ethers.utils.parseEther('100'));
      await token.connect(bob).approve(exchange.address, ethers.utils.parseEther('100'));
      const depositTokenTx = await exchange.connect(bob).depositToken(token.address, ethers.utils.parseEther('100'));

      await expect(depositTokenTx).to.emit(exchange, 'Deposit').withArgs(token.address, bob.address, ethers.utils.parseEther('100'), ethers.utils.parseEther('100'));
    });

    it("throws when deposit ETHER", async () => {
      const depositTokenTx = exchange.depositToken(ETHER_ADDRESS, ethers.utils.parseEther('100'));
      await expect(depositTokenTx).to.be.revertedWith("Cannot deposit ETHER");
    })

    it("throws when deposit more tokens than owned", async () => {
      const depositTokenTx = exchange.connect(bob).depositToken(token.address, ethers.utils.parseEther('100'));
      await expect(depositTokenTx).to.be.revertedWith("Insufficient tokens!");
    });

    it("throws when deposit tokens without approval", async () => {
      await token.transfer(bob.address, ethers.utils.parseEther('100'));
      const depositTokenTx = exchange.connect(bob).depositToken(token.address, ethers.utils.parseEther('100'));
      await expect(depositTokenTx).to.be.revertedWith("Insufficient allowance!");
    });
  });

  describe("withdrawToken", () => {
    it("withdraws token to the caller address", async () => {
      await token.transfer(bob.address, ethers.utils.parseEther('100'));
      await token.connect(bob).approve(exchange.address, ethers.utils.parseEther('100'));
      await exchange.connect(bob).depositToken(token.address, ethers.utils.parseEther('90'));
      await exchange.connect(bob).withdrawToken(token.address, ethers.utils.parseEther('60'));
      expect(await token.balanceOf(bob.address)).to.equal(ethers.utils.parseEther('70'));
      expect(await exchange.tokens(token.address, bob.address)).to.equal(ethers.utils.parseEther('30'));
    });

    it("fire 'Withdraw' event when succesfully withdraw token", async () => {
      await token.transfer(bob.address, ethers.utils.parseEther('100'));
      await token.connect(bob).approve(exchange.address, ethers.utils.parseEther('100'));
      await exchange.connect(bob).depositToken(token.address, ethers.utils.parseEther('90'));
      const withdrawTokenTx = await exchange.connect(bob).withdrawToken(token.address, ethers.utils.parseEther('60'));
      await expect(withdrawTokenTx).to.emit(exchange, 'Withdraw').withArgs(token.address, bob.address, ethers.utils.parseEther('60'), ethers.utils.parseEther('30'));
    });

    it("throws when withdraw ETHER", async () => {
      const withdrawTokenTX = exchange.withdrawToken(ETHER_ADDRESS, ethers.utils.parseEther('1'));
      await expect(withdrawTokenTX).to.be.revertedWith("Cannot withdraw ETHER");
    });

    it("throws when withdraw more token than owned", async () => {
      const withdrawTokenTX = exchange.withdrawToken(token.address, ethers.utils.parseEther('200'));
      await expect(withdrawTokenTX).to.be.revertedWith("Not enough token");
    });
  });

  describe("balanceOf", () => {
    it("returns balance of the caller for the specified token", async () => {
      await exchange.connect(bob).depositEther({ value: ethers.utils.parseEther('1') });
      expect(await exchange.balanceOf(ETHER_ADDRESS, bob.address)).to.equal(ethers.utils.parseEther('1'));
    });
  });
});
