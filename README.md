# Advanced Sample Hardhat Project

This project demonstrates an advanced Hardhat use case, integrating other tools commonly used alongside Hardhat in the ecosystem.

The project comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts. It also comes with a variety of other tools, preconfigured to work with the project code.

Install Dependencies

Copy .env.example file and change its name to .env in the project folder
Copy networks.example.json file and change its name to networks.json in the project folder.Enter your Etherscan API key, your Ropsten(Rinkeby) node URL (eg from Alchemy), and the private key of the account which will send the deployment transaction.

Run ```npm i``` to install all dependencies

Compile Contracts
```
npx hardhat compile
```

Deploy contracts
```
npx hardhat deploy 
```


Try running some of the following tasks:

```shell

npm run test -> to run test in test/hardhat folder, make forking enabled false in networks.json
npm run test:fork -> to run test in test/fork folder, make forking enabled true in networks.json
npx hardhat accounts 
npm run compile -> to run prettier task and compile contracts
npm run deploy -> to run  eslint --fix task and deploy contracts locally
npm run verify:rinkeby -> to veryfy contracts deployed in rinkeby
npm run verify:mainnet -> to veryfy contracts deployed in mainnet
npm run eslint -> to run task in deploy, test, tasks, utils folders for all js files
npm run eslint:fix -> to run eslint --fix task in deploy, test, tasks, utils folders for all js files
npm run solhint -> to run solhint command for all .sol files in contracts folder
```

# Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Ropsten, Rinkeby.

In this project, copy the .env.template file to a file named .env, and then edit it to fill in the details. With a valid .env file in place, first deploy your contract:

```shell
npx hardhat deploy --network rinkeby
```

Then, for verifying contracts run`

```shell
npm run verify:rinkeby
```