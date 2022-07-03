const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC20 Contract", () => {
    let contract;
    let owner, bob, alice;

    beforeEach(async () => {
        const Token = await ethers.getContractFactory("Token");
        contract = await Token.deploy('Gemcoin', 'GEM', 18, ethers.utils.parseEther('1000'));
        await contract.deployed();
        [owner, bob, alice] = await ethers.getSigners();
    });

    describe("name", () => {
        it("has a correct name", async () => {
            expect(await contract.name())
                .to.equal("Gemcoin");
        });
    });

    describe("symbol", () => {
        it("has a correct symbol", async () => {
            expect(await contract.symbol())
                .to.equal("GEM");
        });
    });

    describe("decimals", () => {
        it("has correct decimals", async () => {
            expect(await contract.decimals())
                .to.equal(18);
        });
    });

    describe("totalSupply", () => {
        it("has the total supply of 1000", async () => {
            expect(await contract.totalSupply())
                .to.equal(ethers.utils.parseEther('1000'));
        });
    });

    describe("balanceOf", () => {
        it("allocates the total supply to owner account", async () => {
            expect(await contract.balanceOf(owner.address))
                .to.equal(ethers.utils.parseEther('1000'));
        });
    });

    describe("transfer", () => {
        it("transfer tokens from owner account to bob account", async () => {
            await contract.connect(owner)
                .transfer(bob.address, ethers.utils.parseEther('300'));

            expect(await contract.balanceOf(bob.address))
                .to.equal(ethers.utils.parseEther('300'));

            expect(await contract.balanceOf(owner.address))
                .to.equal(ethers.utils.parseEther('700'));
        });

        it("fire 'Tansfer' event when sucessfully transfer token ownership", async () => {
            const transferTx = await contract.connect(owner)
                .transfer(bob.address, ethers.utils.parseEther('300'));

            await expect(transferTx)
                .to.emit(contract, 'Transfer')
                .withArgs(owner.address, bob.address, ethers.utils.parseEther('300'))
        });

        it("throws when transfer to the zero address", async () => {
            const transferTx = contract.connect(owner)
                .transfer(ethers.constants.AddressZero, ethers.utils.parseEther('300'));

            await expect(transferTx)
                .to.be.revertedWith("Transfer to the zero address");
        });

        it("throws when transfer more token than owned", async () => {
            const transferTx = contract.connect(owner)
                .transfer(bob.address, ethers.utils.parseEther('2000'));

            await expect(transferTx)
                .to.be.revertedWith("Insufficient tokens!");
        });
    });

    describe("transferFrom", () => {
        it("transfer tokens from owner account to alice account through bob account, deducting allowance", async () => {
            await contract.connect(owner)
                .approve(bob.address, ethers.utils.parseEther('100'));

            await contract.connect(bob)
                .transferFrom(owner.address, alice.address, ethers.utils.parseEther('50'));

            expect(await contract.balanceOf(alice.address))
                .to.equal(ethers.utils.parseEther('50'));

            expect(await contract.balanceOf(owner.address))
                .to.equal(ethers.utils.parseEther('950'));

            expect(await contract.allowance(owner.address, bob.address))
                .to.equal(ethers.utils.parseEther('50'));
        });

        it("fire 'Tansfer' event when sucessfully called transferFrom function", async () => {
            await contract.connect(owner)
                .approve(bob.address, ethers.utils.parseEther('100'));

            const transferTx = await contract.connect(bob)
                .transferFrom(owner.address, alice.address, ethers.utils.parseEther('100'));

            await expect(transferTx)
                .to.emit(contract, 'Transfer')
                .withArgs(owner.address, alice.address, ethers.utils.parseEther('100'))
        });

        it("throws when transfer to the zero address", async () => {
            const transferTx = contract.connect(bob)
                .transferFrom(owner.address, ethers.constants.AddressZero, ethers.utils.parseEther('100'));

            await expect(transferTx)
                .to.be.revertedWith("Transfer to the zero address!");
        });

        it("throws when transfer more tokens than owned", async () => {
            const transferTx = contract.connect(bob)
                .transferFrom(owner.address, alice.address, ethers.utils.parseEther('2000'));

            await expect(transferTx)
                .to.be.revertedWith("Insufficient tokens!");
        });

        it("throws when transfer exceeds approved tokens", async () => {
            await contract.connect(owner)
                .approve(bob.address, ethers.utils.parseEther('100'))

            const transferTx = contract.connect(bob)
                .transferFrom(owner.address, alice.address, ethers.utils.parseEther('200'));

            await expect(transferTx)
                .to.be.revertedWith("Insufficient allowance!");
        });
    });

    describe("approve", () => {
        it("approves bob account to spend 100 tokens on owner account behalf", async () => {
            await contract.connect(owner)
                .approve(bob.address, ethers.utils.parseEther('100'));

            expect(await contract.allowance(owner.address, bob.address))
                .to.equal(ethers.utils.parseEther('100'));
        });

        it("fire 'Approval' event when successfully called approve function", async () => {
            const approveTx = await contract.connect(owner)
                .approve(bob.address, ethers.utils.parseEther('100'));

            await expect(approveTx)
                .to.emit(contract, 'Approval')
                .withArgs(owner.address, bob.address, ethers.utils.parseEther('100'));
        });

        it("throws when approve to the zero address", async () => {
            const approveTx = contract.connect(owner)
                .approve(ethers.constants.AddressZero, ethers.utils.parseEther('100'))

            await expect(approveTx)
                .to.be.revertedWith("Approve to the zero address!");
        });
    });

    describe("allowance", () => {
        it("return allowed amount that can be transferred by bob on alice behalf", async () => {
            await contract.connect(alice)
                .approve(bob.address, ethers.utils.parseEther('200'));

            expect(await contract.allowance(alice.address, bob.address))
                .to.equal(ethers.utils.parseEther('200'));
        });
    });

    describe("mint", () => {
        it("create new tokens to the bob account, increasing total supply", async () => {
            await contract.connect(owner)
                .mint(bob.address, ethers.utils.parseEther('500'));

            expect(await contract.balanceOf(bob.address))
                .to.equal(ethers.utils.parseEther('500'));

            expect(await contract.totalSupply())
                .to.equal(ethers.utils.parseEther('1500'));
        });

        it("fire 'Transfer' even when successfully called the mint function", async () => {
            const mintTx = await contract.connect(owner)
                .mint(bob.address, ethers.utils.parseEther('500'));

            await expect(mintTx)
                .to.emit(contract, 'Transfer')
                .withArgs(ethers.constants.AddressZero, bob.address, ethers.utils.parseEther('500'));
        });

        it("throws when mint to the zero address", async () => {
            const mintTx = contract.connect(owner)
                .mint(ethers.constants.AddressZero, ethers.utils.parseEther('100'));

            await expect(mintTx)
                .to.be.revertedWith("Mint to the zero address!");
        });

        it("throws when mint by other account than owner", async () => {
            const mintTx = contract.connect(bob)
                .mint(alice.address, ethers.utils.parseEther('100'));

            await expect(mintTx)
                .to.be.revertedWith("Not an owner");
        });
    });

    describe("burn", () => {
        it("burn tokens from the caller account, reducing total supply", async () => {
            await contract.connect(owner)
                .burn(ethers.utils.parseEther('200'));

            expect(await contract.balanceOf(owner.address))
                .to.equal(ethers.utils.parseEther('800'));

            expect(await contract.totalSupply())
                .to.equal(ethers.utils.parseEther('800'));
        });

        it("fire 'Transfer' even when successfully called the burn function", async () => {
            const burnTx = await contract.connect(owner)
                .burn(ethers.utils.parseEther('200'));

            await expect(burnTx)
                .to.emit(contract, 'Transfer')
                .withArgs(owner.address, ethers.constants.AddressZero, ethers.utils.parseEther('200'));
        });

        it("throws when burn more tokens than owned", async () => {
            const burnTx = contract.connect(owner)
                .burn(ethers.utils.parseEther('2000'));

            await expect(burnTx)
                .to.be.revertedWith("Burn amount exceeds balance!");
        });
    });

    describe("burnFrom", () => {
        it("burn tokens from the owner account through bob account, reducing total supply and allowance", async () => {
            await contract.connect(owner)
                .approve(bob.address, ethers.utils.parseEther('200'));

            await contract.connect(bob)
                .burnFrom(owner.address, ethers.utils.parseEther('100'));

            expect(await contract.balanceOf(owner.address))
                .to.equal(ethers.utils.parseEther('900'));

            expect(await contract.totalSupply())
                .to.equal(ethers.utils.parseEther('900'));

            expect(await contract.allowance(owner.address, bob.address))
                .to.equal(ethers.utils.parseEther('100'));
        });

        it("fire 'Transfer' even when successfully called the burnFrom function", async () => {
            await contract.connect(owner)
                .approve(bob.address, ethers.utils.parseEther('200'));

            const burnFromTx = await contract.connect(bob)
                .burnFrom(owner.address, ethers.utils.parseEther('100'));

            await expect(burnFromTx)
                .to.emit(contract, 'Transfer')
                .withArgs(owner.address, ethers.constants.AddressZero, ethers.utils.parseEther('100'));
        });

        it("throws when burn from the zero address", async () => {
            const burnFromTx = contract.connect(bob)
                .burnFrom(ethers.constants.AddressZero, ethers.utils.parseEther('100'));

            await expect(burnFromTx)
                .to.be.revertedWith("Burn from the zero address!");
        });

        it("throws when burn more tokens than owned", async () => {
            const burnFromTx = contract.connect(bob)
                .burnFrom(owner.address, ethers.utils.parseEther('2000'));

            await expect(burnFromTx)
                .to.be.revertedWith("Burn amount exceeds balance");
        });

        it("throws when burn amount exceeds approved tokens", async () => {
            await contract.connect(owner)
                .approve(bob.address, ethers.utils.parseEther('100'));

            const burnFromTx = contract.connect(bob)
                .burnFrom(owner.address, ethers.utils.parseEther('200'));

            await expect(burnFromTx)
                .to.be.revertedWith("Insufficient allowance!");
        });
    });
});