module.exports = async ({ deployments: { deploy }, ethers: { getNamedSigners, getContract } }) => {
	const { deployer } = await getNamedSigners();

	const gameMaster = await getContract("GameMaster");

	await deploy("TicTacToe", {
		from: deployer.address,
		contract: "TicTacToe",
		args: [gameMaster.address],
		log: true
	});
};

module.exports.tags = ["TicTacToe", "Hardhat"];
module.exports.dependencies = ["GameMaster"];
