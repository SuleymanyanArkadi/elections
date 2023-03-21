/* eslint-disable no-unused-expressions */
const { expect } = require("chai");
const {
	ethers: {
		provider,
		getContract,
		getNamedSigners,
		utils: { formatBytes32String /* parseBytes32String */ },
		BigNumber,
	},
	deployments: { fixture, createFixture },
} = require("hardhat");
// const {
// 	time: { advanceBlockTo, increaseTo },
// } = require("@openzeppelin/test-helpers");

describe("Election", function () {
	let deployer, voter1; /* voter2, voter3 */
	let election, adminRole;
	const VoterGroup = { All: 0, Group1: 1, Group2: 2, Group3: 3 };
	const testVotingName = formatBytes32String("Test");
	const createVoting = async ({
		caller = deployer,
		name = "Test",
		duration = 120,
		options = ["Candidate 1", "Candidate 2", "Candidate 3"],
		description = "Test voting",
		group = VoterGroup.All,
	}) => {
		return await election.connect(caller).createVoting(
			formatBytes32String(name),
			duration,
			options.map((option) => formatBytes32String(option)),
			formatBytes32String(description),
			group
		);
	};

	const setupFixture = createFixture(async () => {
		await fixture(["Hardhat"]);

		const election = await getContract("Election");
		adminRole = await election.DEFAULT_ADMIN_ROLE();

		return [election];
	});

	before("Before All: ", async function () {
		({ deployer, voter1 /* , voter2, voter3 */ } = await getNamedSigners());
	});

	beforeEach(async function () {
		[election] = await setupFixture();
	});

	describe("addVoter: ", function () {
		it("Should add a new voter and emit 'VoterAdded'", async function () {
			const tx = await election.addVoter(voter1.address, VoterGroup.Group1);
			const addedVoter = await election.voters(voter1.address);

			expect(addedVoter.whitelisted).to.be.true;
			expect(addedVoter.group).to.equal(VoterGroup.Group1);

			const events = await election.queryFilter("VoterAdded", tx.blockNumber);
			expect(events.length).to.equal(1);
			expect(events[0].args.voter).to.equal(voter1.address);
			expect(events[0].args.group).to.equal(VoterGroup.Group1);
		});

		it("Should revert if the voter has already been added", async function () {
			// Add a voter
			await election.addVoter(voter1.address, VoterGroup.Group1);

			// Attempt to add the same voter again
			await expect(election.addVoter(voter1.address, VoterGroup.Group1)).to.be.revertedWith(
				"Voter already added"
			);
		});

		it("Should revert if the caller is not an admin", async function () {
			const errorMsg = `AccessControl: account ${voter1.address.toLowerCase()} is missing role ${adminRole}`;
			// Attempt to add a new voter without being an admin
			await expect(election.connect(voter1).addVoter(voter1.address, VoterGroup.Group1)).to.be.revertedWith(
				errorMsg
			);
		});
	});

	describe("modifyVoter: ", function () {
		it("Should modify voter and emit 'VoterModified'", async function () {
			await election.addVoter(voter1.address, VoterGroup.Group1);
			const tx = await election.modifyVoter(voter1.address, VoterGroup.All);
			const voter = await election.voters(voter1.address);

			expect(voter.whitelisted).to.be.true;
			expect(voter.group).to.equal(VoterGroup.All);

			const events = await election.queryFilter("VoterModified", tx.blockNumber);
			expect(events.length).to.equal(1);
			expect(events[0].args.voter).to.equal(voter1.address);
			expect(events[0].args.group).to.equal(VoterGroup.All);
		});

		it("Should revert if the voter hasn't been added yet", async function () {
			// Attempt to modify the non-existent voter
			await expect(election.modifyVoter(voter1.address, VoterGroup.All)).to.be.revertedWith(
				"Voter does not exist"
			);
		});

		it("Should revert if the caller is not an admin", async function () {
			await election.addVoter(voter1.address, VoterGroup.Group1);

			const errorMsg = `AccessControl: account ${voter1.address.toLowerCase()} is missing role ${adminRole}`;
			// Attempt to add a new voter without being an admin
			await expect(election.connect(voter1).modifyVoter(voter1.address, VoterGroup.All)).to.be.revertedWith(
				errorMsg
			);
		});
	});

	describe("removeVoter: ", function () {
		it("Should remove voter and emit 'VoterRemoved'", async function () {
			await election.addVoter(voter1.address, VoterGroup.Group1);
			const tx = await election.removeVoter(voter1.address);
			const voter = await election.voters(voter1.address);

			expect(voter.whitelisted).to.be.false;

			const events = await election.queryFilter("VoterRemoved", tx.blockNumber);
			expect(events.length).to.equal(1);
			expect(events[0].args.voter).to.equal(voter1.address);
		});

		it("Should revert if the voter hasn't been added yet", async function () {
			// Attempt to remove the non-existent voter
			await expect(election.removeVoter(voter1.address)).to.be.revertedWith("Voter does not exist");
		});

		it("Should revert if the caller is not an admin", async function () {
			await election.addVoter(voter1.address, VoterGroup.Group1);

			const errorMsg = `AccessControl: account ${voter1.address.toLowerCase()} is missing role ${adminRole}`;
			// Attempt to add a new voter without being an admin
			await expect(election.connect(voter1).removeVoter(voter1.address)).to.be.revertedWith(errorMsg);
		});
	});

	describe("createVoting: ", function () {
		it("Should create voting and emit 'VotingCreated'", async function () {
			const tx = await createVoting({});
			const time = (await provider.getBlock(tx.blockNumber)).timestamp;
			const options = await election.getOptions(testVotingName);
			const voting = await election.votings(testVotingName);

			expect(voting.description).to.equal(formatBytes32String("Test voting"));
			expect(voting.endTime).to.equal(BigNumber.from(time + 120));
			expect(voting.group).to.deep.equal(VoterGroup.All);
			expect(options).to.eql(
				["Candidate 1", "Candidate 2", "Candidate 3"].map((option) => formatBytes32String(option))
			);

			const events = await election.queryFilter("VotingCreated", tx.blockNumber);
			expect(events.length).to.equal(1);
			expect(events[0].args.votingName).to.equal(testVotingName);
			expect(events[0].args.group).to.equal(VoterGroup.All);
			expect(events[0].args.endTime).to.equal(time + 120);
		});

		it("Should revert if the voting with same name already created", async function () {
			await createVoting({});

			await expect(createVoting({})).to.be.revertedWith("Voting topic already exists");
		});

		it("Should revert if not enough options", async function () {
			await expect(createVoting({ options: ["1 option"] })).to.be.revertedWith("At least two option is required");
		});

		it("Should revert if the caller is not an admin", async function () {
			const errorMsg = `AccessControl: account ${voter1.address.toLowerCase()} is missing role ${adminRole}`;

			await expect(createVoting({ caller: voter1 })).to.be.revertedWith(errorMsg);
		});
	});

	describe("vote: ", function () {
		it("Should vote and emit 'VoteCasted'", async function () {
			await election.addVoter(voter1.address, VoterGroup.Group1);
			await createVoting({});

			const tx = await election.connect(voter1).vote(testVotingName, formatBytes32String("Candidate 1"));
			const results = await election.getResults(testVotingName);

			expect(results).to.eql([1, 0, 0].map((result) => BigNumber.from(result)));
			expect(await election.isVoted(testVotingName, voter1.address)).to.be.true;

			const events = await election.queryFilter("VoteCasted", tx.blockNumber);
			expect(events.length).to.equal(1);
			expect(events[0].args.votingName).to.equal(testVotingName);
			expect(events[0].args.voter).to.equal(voter1.address);
			expect(events[0].args.option).to.equal(formatBytes32String("Candidate 1"));
		});

		xit("Should revert if the voting with same name already created", async function () {
			await createVoting({});

			await expect(createVoting({})).to.be.revertedWith("Voting topic already exists");
		});

		xit("Should revert if not enough options", async function () {
			await expect(createVoting({ options: ["1 option"] })).to.be.revertedWith("At least two option is required");
		});

		xit("Should revert if the caller is not an admin", async function () {
			const errorMsg = `AccessControl: account ${voter1.address.toLowerCase()} is missing role ${adminRole}`;

			await expect(createVoting({ caller: voter1 })).to.be.revertedWith(errorMsg);
		});
	});
	// ...
});
