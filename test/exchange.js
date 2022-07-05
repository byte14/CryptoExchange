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
    [deployer, feeAccount, bob, alice] = await ethers.getSigners();
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
      await exchange.connect(bob).depositEther({ value: ethers.utils.parseEther('10') });
      expect(await exchange.tokens(ETHER_ADDRESS, bob.address)).to.equal(ethers.utils.parseEther('10'));
    });

    it("fire 'Deposit' event when successfuly deposit ether", async () => {
      const depositEtherTx = await exchange.connect(bob).depositEther({ value: ethers.utils.parseEther('10') });
      await expect(depositEtherTx).to.emit(exchange, 'Deposit').withArgs(ETHER_ADDRESS, bob.address, ethers.utils.parseEther('10'), ethers.utils.parseEther('10'));
    });
  });

  describe("withdrawEther", () => {
    beforeEach(async () => {
      await exchange.connect(bob).depositEther({ value: ethers.utils.parseEther('25') });
    });

    describe("success", () => {
      it("withdraws ether to the caller address", async () => {
        await exchange.connect(bob).withdrawEther(ethers.utils.parseEther('10'));
        expect(await exchange.tokens(ETHER_ADDRESS, bob.address)).to.equal(ethers.utils.parseEther('15'));
      });

      it("fire 'Withdraw' event when successfully withdraw ETHER", async () => {
        const withdrawEtherTx = await exchange.connect(bob).withdrawEther(ethers.utils.parseEther('10'));
        await expect(withdrawEtherTx).to.emit(exchange, 'Withdraw').withArgs(ETHER_ADDRESS, bob.address, ethers.utils.parseEther('10'), ethers.utils.parseEther('15'));
      });
    });
    describe("failure", () => {
      it("throws when withdraw more ETHER than owned", async () => {
        const withdrawEtherTx = exchange.connect(bob).withdrawEther(ethers.utils.parseEther('30'));
        await expect(withdrawEtherTx).to.be.revertedWith("Not enough ETHER");
      });
    });
  });

  describe("depositToken", () => {
    describe("success", () => {
      beforeEach(async () => {
        await token.transfer(bob.address, ethers.utils.parseEther('100'));
        await token.connect(bob).approve(exchange.address, ethers.utils.parseEther('100'));
      });

      it("deposits the token to the contract address", async () => {
        await exchange.connect(bob).depositToken(token.address, ethers.utils.parseEther('100'));
        expect(await token.balanceOf(exchange.address)).to.equal(ethers.utils.parseEther('100'));
        expect(await exchange.tokens(token.address, bob.address)).to.equal(ethers.utils.parseEther('100'));
      });

      it("fire 'Deposit' event when successfully deposit token", async () => {
        const depositTokenTx = await exchange.connect(bob).depositToken(token.address, ethers.utils.parseEther('100'));
        await expect(depositTokenTx).to.emit(exchange, 'Deposit').withArgs(token.address, bob.address, ethers.utils.parseEther('100'), ethers.utils.parseEther('100'));
      });
    });

    describe("failure", () => {
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
  });

  describe("withdrawToken", () => {
    describe("success", async () => {
      beforeEach(async () => {
        await token.transfer(bob.address, ethers.utils.parseEther('100'));
        await token.connect(bob).approve(exchange.address, ethers.utils.parseEther('100'));
        await exchange.connect(bob).depositToken(token.address, ethers.utils.parseEther('90'));
      });

      it("withdraws token to the caller address", async () => {
        await exchange.connect(bob).withdrawToken(token.address, ethers.utils.parseEther('60'));
        expect(await token.balanceOf(bob.address)).to.equal(ethers.utils.parseEther('70'));
        expect(await exchange.tokens(token.address, bob.address)).to.equal(ethers.utils.parseEther('30'));
      });

      it("fire 'Withdraw' event when succesfully withdraw token", async () => {
        const withdrawTokenTx = await exchange.connect(bob).withdrawToken(token.address, ethers.utils.parseEther('60'));
        await expect(withdrawTokenTx).to.emit(exchange, 'Withdraw').withArgs(token.address, bob.address, ethers.utils.parseEther('60'), ethers.utils.parseEther('30'));
      });
    });

    describe("failure", () => {
      it("throws when withdraw ETHER", async () => {
        const withdrawTokenTx = exchange.withdrawToken(ETHER_ADDRESS, ethers.utils.parseEther('1'));
        await expect(withdrawTokenTx).to.be.revertedWith("Cannot withdraw ETHER");
      });

      it("throws when withdraw more token than owned", async () => {
        const withdrawTokenTx = exchange.withdrawToken(token.address, ethers.utils.parseEther('200'));
        await expect(withdrawTokenTx).to.be.revertedWith("Not enough token");
      });
    });
  });

  describe("balanceOf", () => {
    it("returns balance of the caller for the specified token", async () => {
      await exchange.connect(bob).depositEther({ value: ethers.utils.parseEther('5') });
      expect(await exchange.balanceOf(ETHER_ADDRESS, bob.address)).to.equal(ethers.utils.parseEther('5'));
    });
  });

  describe("makeOrder", () => {
    beforeEach(async () => {
      await exchange.connect(bob).depositEther({ value: ethers.utils.parseEther('50') });
    });

    describe("success", () => {
      it("increments order count by 1 each time order is made", async () => {
        await exchange.connect(bob).makeOrder(token.address, ethers.utils.parseEther('20'), ETHER_ADDRESS, ethers.utils.parseEther('10'));
        expect(await exchange.orderCount()).to.equal(1);
        await exchange.connect(bob).makeOrder(token.address, ethers.utils.parseEther('24'), ETHER_ADDRESS, ethers.utils.parseEther('11'));
        expect(await exchange.orderCount()).to.equal(2);
      });

      it("makes an order", async () => {
        await exchange.connect(bob).makeOrder(token.address, ethers.utils.parseEther('20'), ETHER_ADDRESS, ethers.utils.parseEther('10'));
        const bobOrder = await exchange.orders(1);
        expect(await bobOrder.id).to.equal(1)
        expect(await bobOrder.user).to.equal(bob.address)
        expect(await bobOrder.tokenBuy).to.equal(token.address)
        expect(await bobOrder.amountBuy).to.equal(ethers.utils.parseEther('20'))
        expect(await bobOrder.tokenSell).to.equal(ETHER_ADDRESS)
        expect(await bobOrder.amountSell).to.equal(ethers.utils.parseEther('10'))
      });

      it("fire 'Order' event when succesfully make an order", async () => {
        const makeOrderTx = await exchange.connect(bob).makeOrder(token.address, ethers.utils.parseEther('20'), ETHER_ADDRESS, ethers.utils.parseEther('10'));
        const result = await makeOrderTx.wait();
        const orderTimestamp = result.events[0].args.timestamp;

        await expect(makeOrderTx).to.emit(exchange, 'Order').withArgs(1, bob.address, token.address, ethers.utils.parseEther('20'), ETHER_ADDRESS, ethers.utils.parseEther('10'), orderTimestamp)
      });
    });

    describe("failure", () => {
      it("throws when makes an order without sufficient tokens", async () => {
        const makeOrderTx = exchange.connect(bob).makeOrder(token.address, ethers.utils.parseEther('20'), ETHER_ADDRESS, ethers.utils.parseEther('70'));
        await expect(makeOrderTx).to.be.revertedWith("Not enough tokens");
      });
    });
  });

  describe("cancelOrder", () => {
    beforeEach(async () => {
      await exchange.connect(bob).depositEther({ value: ethers.utils.parseEther('50') });
      await exchange.connect(bob).makeOrder(token.address, ethers.utils.parseEther('20'), ETHER_ADDRESS, ethers.utils.parseEther('10'));
    });
    describe("success", () => {
      it("cancels an order", async () => {
        await exchange.connect(bob).cancelOrder(1)
        expect(await exchange.cancelledOrder(1)).to.equal(true);
      });

      it("fire 'Cancel' event when succesfully cancel an order", async () => {
        const cancelOrderTx = await exchange.connect(bob).cancelOrder(1);
        const result = await cancelOrderTx.wait();
        const cancelTimestamp = result.events[0].args.timestamp;

        await expect(cancelOrderTx).to.emit(exchange, 'Cancel').withArgs(1, bob.address, token.address, ethers.utils.parseEther('20'), ETHER_ADDRESS, ethers.utils.parseEther('10'), cancelTimestamp)
      });
    });

    describe("failure", () => {
      it("throws when try to cancel unexisted order", async () => {
        const cancelOrderTx = exchange.connect(bob).cancelOrder(2);
        await expect(cancelOrderTx).to.be.revertedWith("Order does not exist");
      });

      it("throws when try to cancel other's order", async () => {
        const cancelOrderTx = exchange.connect(alice).cancelOrder(1);
        await expect(cancelOrderTx).to.be.revertedWith("Order is not yours");
      });
    });
  });

  describe("fillOrder", () => {
    beforeEach(async () => {
      await token.transfer(alice.address, ethers.utils.parseEther('100'));
      await token.connect(alice).approve(exchange.address, ethers.utils.parseEther('100'));
      await exchange.connect(alice).depositToken(token.address, ethers.utils.parseEther('100'));
      await exchange.connect(bob).depositEther({ value: ethers.utils.parseEther('50') });
      await exchange.connect(bob).makeOrder(token.address, ethers.utils.parseEther('20'), ETHER_ADDRESS, ethers.utils.parseEther('10'));
    });

    describe("success", () => {
      it("fills order and make a trade", async () => {
        await exchange.connect(alice).fillOrder(1);
        expect(await exchange.tokens(token.address, alice.address)).to.equal(ethers.utils.parseEther('78'));
        expect(await exchange.tokens(token.address, bob.address)).to.equal(ethers.utils.parseEther('20'));
        expect(await exchange.tokens(ETHER_ADDRESS, alice.address)).to.equal(ethers.utils.parseEther('10'));
        expect(await exchange.tokens(ETHER_ADDRESS, bob.address)).to.equal(ethers.utils.parseEther('40'));
        expect(await exchange.tokens(token.address, feeAccount.address)).to.equal(ethers.utils.parseEther('2'));
        expect(await exchange.filledOrder(1)).to.equal(true);
      });

      it("fire 'Trade' event when succesfully filled an order", async () => {
        const fillOrderTx = await exchange.connect(alice).fillOrder(1);
        const result = await fillOrderTx.wait();
        const fillTimestamp = result.events[0].args.timestamp;
        await expect(fillOrderTx).to.emit(exchange, 'Trade').withArgs(1, bob.address, token.address, ethers.utils.parseEther('20'), ETHER_ADDRESS, ethers.utils.parseEther('10'), alice.address, fillTimestamp);
      });
    });

    describe("failure", () => {
      it("throws when try to fill unexisted order", async () => {
        const fillOrderTx = exchange.connect(bob).fillOrder(2);
        await expect(fillOrderTx).to.be.revertedWith("Order does not exist");
      });

      it("throws when try to fill already filled order", async () => {
        await exchange.connect(alice).fillOrder(1);
        const fillOrderTx = exchange.connect(alice).fillOrder(1);
        await expect(fillOrderTx).to.be.revertedWith("Order is already filled or cancelled");
      });

      it("throws when try to fill cancelled order", async () => {
        await exchange.connect(bob).cancelOrder(1);
        const fillOrderTx = exchange.connect(alice).fillOrder(1);
        await expect(fillOrderTx).to.be.revertedWith("Order is already filled or cancelled");
      });
    });
  });
});
