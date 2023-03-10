const { expect } = require("chai");
const {
	ethers: {
		getContract,
		getNamedSigners,
		utils: { parseUnits },
		BigNumber,
		constants
	},
	deployments: { fixture, createFixture }
} = require("hardhat");
const {
	time: { advanceBlockTo }
} = require("@openzeppelin/test-helpers");

describe("GameMaster", function () {
	let playerOne, playerTwo, playerThree;
	let gameMaster, ticTacToe;
	const moveDelay = BigNumber.from(10);

	const setupFixture = createFixture(async () => {
		await fixture(["Hardhat"]);

		const gameMaster = await getContract("GameMaster");
		const ticTacToe = await getContract("TicTacToe");
		await gameMaster.addGame(ticTacToe.address, "makeMove(uint8,uint256,uint256[])");

		return [gameMaster, ticTacToe];
	});

	before("Before All: ", async function () {
		({ playerOne, playerTwo, playerThree } = await getNamedSigners());
	});

	beforeEach(async function () {
		[gameMaster, ticTacToe] = await setupFixture();
	});

	describe("Initialization: ", function () {
		it("Should initialize with correct values", async function () {
			expect(await gameMaster.minBid()).to.equal(parseUnits("1", 16));
		});
	});

	describe("addGame: ", function () {
		it("Should add new game", async function () {
			await gameMaster.addGame(playerOne.address, "makeMove(uint8,uint8,uint256,uint256[])");

			expect(await gameMaster.makeMoveSignature(playerOne.address)).to.eq(
				"makeMove(uint8,uint8,uint256,uint256[])"
			);
		});

		it("Should revert with 'Ownable: caller is not the owner'", async function () {
			await expect(
				gameMaster.connect(playerOne).addGame(playerOne.address, "makeMove(uint8,uint8,uint256,uint256[])")
			).to.be.revertedWith("Ownable: caller is not the owner");
		});
	});

	describe("removeGame: ", function () {
		it("Should remove game", async function () {
			await gameMaster.removeGame(ticTacToe.address);

			expect(await gameMaster.makeMoveSignature(playerOne.address)).to.eq("");
		});

		it("Should revert with 'Ownable: caller is not the owner'", async function () {
			await expect(gameMaster.connect(playerOne).removeGame(ticTacToe.address)).to.be.revertedWith(
				"Ownable: caller is not the owner"
			);
		});
	});

	describe("setMinBid: ", function () {
		it("Should set new minimal bid amount", async function () {
			await gameMaster.setMinBid(parseUnits("1"));

			expect(await gameMaster.minBid()).to.eq(parseUnits("1"));
		});

		it("Should revert with 'Ownable: caller is not the owner'", async function () {
			await expect(gameMaster.connect(playerOne).setMinBid(parseUnits("1"))).to.be.revertedWith(
				"Ownable: caller is not the owner"
			);
		});
	});

	describe("newMatch: ", function () {
		it("Should create new match", async function () {
			await gameMaster
				.connect(playerOne)
				.newMatch(ticTacToe.address, playerTwo.address, moveDelay, { value: parseUnits("1", 16) });

			expect(await gameMaster.matches(0)).to.eql([
				ticTacToe.address,
				playerOne.address,
				playerTwo.address,
				0,
				0,
				moveDelay,
				parseUnits("1", 16),
				constants.Zero
			]);
		});

		it("Should emit 'MatchCreated'", async function () {
			await expect(
				gameMaster
					.connect(playerOne)
					.newMatch(ticTacToe.address, playerTwo.address, moveDelay, { value: parseUnits("1", 16) })
			)
				.to.emit(gameMaster, "MatchCreated")
				.withArgs(0, ticTacToe.address, playerOne.address, playerTwo.address, moveDelay, parseUnits("1", 16));
		});

		it("Should revert with 'Not enough bid'", async function () {
			await expect(
				gameMaster
					.connect(playerOne)
					.newMatch(ticTacToe.address, playerTwo.address, moveDelay, { value: parseUnits("1", 15) })
			).to.be.revertedWith("Not enough bid");
		});

		it("Should revert with 'Same address for players'", async function () {
			await expect(
				gameMaster
					.connect(playerOne)
					.newMatch(ticTacToe.address, playerOne.address, moveDelay, { value: parseUnits("1", 16) })
			).to.be.revertedWith("Same address for players");
		});

		it("Should revert with 'Game does not exist'", async function () {
			await expect(
				gameMaster
					.connect(playerOne)
					.newMatch(playerTwo.address, playerTwo.address, moveDelay, { value: parseUnits("1", 16) })
			).to.be.revertedWith("Game does not exist");
		});
	});

	describe("acceptMatch: ", function () {
		beforeEach(async function () {
			await gameMaster
				.connect(playerOne)
				.newMatch(ticTacToe.address, playerTwo.address, 10, { value: parseUnits("1", 16) });
		});

		it("Should accept match", async function () {
			const tx = await gameMaster.connect(playerTwo).acceptMatch(0, { value: parseUnits("1", 16) });

			expect(await gameMaster.matches(0)).to.eql([
				ticTacToe.address,
				playerOne.address,
				playerTwo.address,
				1,
				1,
				moveDelay,
				parseUnits("1", 16),
				BigNumber.from(tx.blockNumber)
			]);
		});

		it("Should emit 'MatchAccepted'", async function () {
			await expect(gameMaster.connect(playerTwo).acceptMatch(0, { value: parseUnits("1", 16) }))
				.to.emit(gameMaster, "MatchAccepted")
				.withArgs(0);
		});

		it("Should revert with 'Match does not exist'", async function () {
			await expect(
				gameMaster.connect(playerTwo).acceptMatch(10, { value: parseUnits("1", 16) })
			).to.be.revertedWith("Match does not exist");
		});

		it("Should revert with 'Wrong match'", async function () {
			await expect(
				gameMaster.connect(playerThree).acceptMatch(0, { value: parseUnits("1", 16) })
			).to.be.revertedWith("Wrong match");
		});

		it("Should revert with 'Match already accepted'", async function () {
			await gameMaster.connect(playerTwo).acceptMatch(0, { value: parseUnits("1", 16) });

			await expect(
				gameMaster.connect(playerTwo).acceptMatch(0, { value: parseUnits("1", 16) })
			).to.be.revertedWith("Match already accepted");
		});

		it("Should revert with 'Wrong bid'", async function () {
			await expect(
				gameMaster.connect(playerTwo).acceptMatch(0, { value: parseUnits("2", 16) })
			).to.be.revertedWith("Wrong bid");
		});
	});

	describe("cancelMatch: ", function () {
		beforeEach(async function () {
			await gameMaster
				.connect(playerOne)
				.newMatch(ticTacToe.address, playerTwo.address, 10, { value: parseUnits("1", 16) });
		});

		it("Should cancel match", async function () {
			const tx = gameMaster.connect(playerOne).cancelMatch(0);

			await expect(() => tx).to.changeEtherBalances(
				[gameMaster, playerOne],
				[parseUnits("1", 16).mul(-1), parseUnits("1", 16)]
			);
			await expect(tx).to.emit(gameMaster, "MatchCanceled").withArgs(0);
		});

		it("Should revert with 'Player did not create this match'", async function () {
			await expect(gameMaster.connect(playerTwo).cancelMatch(0)).to.be.revertedWith(
				"Player did not create this match"
			);
		});

		it("Should revert with 'Match already started or finished'", async function () {
			await gameMaster.connect(playerTwo).acceptMatch(0, { value: parseUnits("1", 16) });

			await expect(gameMaster.connect(playerOne).cancelMatch(0)).to.be.revertedWith(
				"Match already started or finished"
			);
		});
	});

	describe("makeMove: ", function () {
		beforeEach(async function () {
			await gameMaster
				.connect(playerOne)
				.newMatch(ticTacToe.address, playerTwo.address, 10, { value: parseUnits("1", 16) });
			await gameMaster.connect(playerTwo).acceptMatch(0, { value: parseUnits("1", 16) });
		});

		it("Should make move and emit 'Move'", async function () {
			await expect(gameMaster.connect(playerOne).makeMove(0, [0, 0]))
				.to.emit(ticTacToe, "Move")
				.withArgs(0, 1, 0, 0);

			const board = await ticTacToe.getBoard(0);
			expect(board[0][0]).to.eq(1);
		});

		it("Should play full match with draw result", async function () {
			// o x o
			// o x x
			// x o o

			await gameMaster.connect(playerOne).makeMove(0, [0, 0]);
			await gameMaster.connect(playerTwo).makeMove(0, [1, 1]);
			await gameMaster.connect(playerOne).makeMove(0, [0, 1]);
			await gameMaster.connect(playerTwo).makeMove(0, [1, 0]);
			await gameMaster.connect(playerOne).makeMove(0, [2, 0]);
			await gameMaster.connect(playerTwo).makeMove(0, [0, 2]);
			await gameMaster.connect(playerOne).makeMove(0, [1, 2]);
			await gameMaster.connect(playerTwo).makeMove(0, [2, 1]);

			const tx = gameMaster.connect(playerOne).makeMove(0, [2, 2]); // last move

			await expect(() => tx).to.changeEtherBalances(
				[gameMaster, playerOne, playerTwo],
				[parseUnits("2", 16).mul(-1), parseUnits("1", 16), parseUnits("1", 16)]
			);
			await expect(tx).to.emit(gameMaster, "MatchFinished").withArgs(0, constants.AddressZero);
			expect(await gameMaster.matches(0)).to.eql([
				ticTacToe.address,
				playerOne.address,
				playerTwo.address,
				3,
				1,
				BigNumber.from(10),
				parseUnits("1", 16),
				BigNumber.from(14)
			]);
		});

		it("Should play full match with win result (row)", async function () {
			// x x x
			// - o o
			// - - -

			await gameMaster.connect(playerOne).makeMove(0, [0, 0]);
			await gameMaster.connect(playerTwo).makeMove(0, [1, 1]);
			await gameMaster.connect(playerOne).makeMove(0, [0, 1]);
			await gameMaster.connect(playerTwo).makeMove(0, [1, 2]);

			const tx = gameMaster.connect(playerOne).makeMove(0, [0, 2]); // last move

			await expect(() => tx).to.changeEtherBalances(
				[gameMaster, playerOne],
				[parseUnits("2", 16).mul(-1), parseUnits("2", 16)]
			);
			await expect(tx).to.emit(gameMaster, "MatchFinished").withArgs(0, playerOne.address);
			expect(await gameMaster.matches(0)).to.eql([
				ticTacToe.address,
				playerOne.address,
				playerTwo.address,
				2,
				1,
				moveDelay,
				parseUnits("1", 16),
				BigNumber.from(10)
			]);
		});

		it("Should play full match with win result (column)", async function () {
			// x - -
			// x o o
			// x - -

			await gameMaster.connect(playerOne).makeMove(0, [0, 0]);
			await gameMaster.connect(playerTwo).makeMove(0, [1, 1]);
			await gameMaster.connect(playerOne).makeMove(0, [1, 0]);
			await gameMaster.connect(playerTwo).makeMove(0, [1, 2]);

			const tx = gameMaster.connect(playerOne).makeMove(0, [2, 0]); // last move

			await expect(() => tx).to.changeEtherBalances(
				[gameMaster, playerOne],
				[parseUnits("2", 16).mul(-1), parseUnits("2", 16)]
			);
			await expect(tx).to.emit(gameMaster, "MatchFinished").withArgs(0, playerOne.address);
			expect(await gameMaster.matches(0)).to.eql([
				ticTacToe.address,
				playerOne.address,
				playerTwo.address,
				2,
				1,
				moveDelay,
				parseUnits("1", 16),
				BigNumber.from(10)
			]);
		});

		it("Should play full match with win result (diagonal 1)", async function () {
			// x o -
			// - x -
			// - o x

			await gameMaster.connect(playerOne).makeMove(0, [0, 0]);
			await gameMaster.connect(playerTwo).makeMove(0, [0, 1]);
			await gameMaster.connect(playerOne).makeMove(0, [2, 2]);
			await gameMaster.connect(playerTwo).makeMove(0, [2, 1]);

			const tx = gameMaster.connect(playerOne).makeMove(0, [1, 1]); // last move

			await expect(() => tx).to.changeEtherBalances(
				[gameMaster, playerOne],
				[parseUnits("2", 16).mul(-1), parseUnits("2", 16)]
			);
			await expect(tx).to.emit(gameMaster, "MatchFinished").withArgs(0, playerOne.address);
			expect(await gameMaster.matches(0)).to.eql([
				ticTacToe.address,
				playerOne.address,
				playerTwo.address,
				2,
				1,
				moveDelay,
				parseUnits("1", 16),
				BigNumber.from(10)
			]);
		});

		it("Should play full match with win result (diagonal 2)", async function () {
			// - o x
			// - x -
			// x o -

			await gameMaster.connect(playerOne).makeMove(0, [0, 2]);
			await gameMaster.connect(playerTwo).makeMove(0, [0, 1]);
			await gameMaster.connect(playerOne).makeMove(0, [2, 0]);
			await gameMaster.connect(playerTwo).makeMove(0, [2, 1]);

			const tx = gameMaster.connect(playerOne).makeMove(0, [1, 1]); // last move

			await expect(() => tx).to.changeEtherBalances(
				[gameMaster, playerOne],
				[parseUnits("2", 16).mul(-1), parseUnits("2", 16)]
			);
			await expect(tx).to.emit(gameMaster, "MatchFinished").withArgs(0, playerOne.address);
			expect(await gameMaster.matches(0)).to.eql([
				ticTacToe.address,
				playerOne.address,
				playerTwo.address,
				2,
				1,
				moveDelay,
				parseUnits("1", 16),
				BigNumber.from(10)
			]);
		});

		it("Should revert with 'Match expired'", async function () {
			await advanceBlockTo(15);

			await expect(gameMaster.connect(playerOne).makeMove(0, [2, 1])).to.be.revertedWith("Match expired");
		});

		it("Should revert with 'Match hasn't started yet'", async function () {
			await gameMaster
				.connect(playerTwo)
				.newMatch(ticTacToe.address, playerOne.address, moveDelay, { value: parseUnits("1", 16) });

			await expect(gameMaster.connect(playerTwo).makeMove(1, [2, 1])).to.be.revertedWith(
				"Match hasn't started yet"
			);
		});

		it("Should revert with 'Another player's move'", async function () {
			await expect(gameMaster.connect(playerTwo).makeMove(0, [2, 1])).to.be.revertedWith("Another player's move");
		});

		it("Should revert with 'MakeMove call failed'", async function () {
			await gameMaster.connect(playerOne).makeMove(0, [0, 2]);

			await expect(gameMaster.connect(playerTwo).makeMove(0, [0, 2])).to.be.revertedWith("MakeMove call failed");
		});

		it("Should revert with 'Match already ended'", async function () {
			await gameMaster.connect(playerOne).makeMove(0, [0, 2]);
			await gameMaster.connect(playerTwo).makeMove(0, [0, 1]);
			await gameMaster.connect(playerOne).makeMove(0, [2, 0]);
			await gameMaster.connect(playerTwo).makeMove(0, [2, 1]);
			await gameMaster.connect(playerOne).makeMove(0, [1, 1]);

			await expect(gameMaster.connect(playerTwo).makeMove(0, [0, 2])).to.be.revertedWith("Match already ended");
		});
	});

	describe("finishExpiredMatch: ", function () {
		beforeEach(async function () {
			await gameMaster
				.connect(playerOne)
				.newMatch(ticTacToe.address, playerTwo.address, 10, { value: parseUnits("1", 16) });
			await gameMaster.connect(playerTwo).acceptMatch(0, { value: parseUnits("1", 16) });
		});

		it("Should finish expired match", async function () {
			await advanceBlockTo(15);

			await expect(() => gameMaster.finishExpiredMatch(0)).to.changeEtherBalances(
				[gameMaster, playerTwo],
				[parseUnits("2", 16).mul(-1), parseUnits("2", 16)]
			);
		});

		it("Should revert with 'Match should be in progress'", async function () {
			await gameMaster
				.connect(playerOne)
				.newMatch(ticTacToe.address, playerTwo.address, 10, { value: parseUnits("1", 16) });

			await expect(gameMaster.finishExpiredMatch(1)).to.be.revertedWith("Match should be in progress");
		});

		it("Should revert with 'Match has not yet expired'", async function () {
			await advanceBlockTo(5);

			await expect(gameMaster.finishExpiredMatch(0)).to.be.revertedWith("Match has not yet expired");
		});
	});
});
