module.exports = async ({ deployments: { deploy }, ethers: { getNamedSigners, utils } }) => {
	const { deployer } = await getNamedSigners();

	const minimalBid = utils.parseUnits("1", 16);

	await deploy("GameMaster", {
		from: deployer.address,
		contract: "GameMaster",
		args: [minimalBid],
		log: true
	});
};

module.exports.tags = ["GameMaster", "Hardhat"];
