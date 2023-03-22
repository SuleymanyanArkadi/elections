module.exports = async ({ deployments: { deploy }, ethers: { getNamedSigners, utils } }) => {
	const { deployer } = await getNamedSigners();

	await deploy("Election", {
		from: deployer.address,
		contract: "Election",
		args: [deployer.address],
		log: true
	});
};

module.exports.tags = ["Election", "testnet"];
