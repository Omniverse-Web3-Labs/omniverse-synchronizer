const OmniverseProtocol = artifacts.require("OmniverseProtocol");
const SkywalkerFungible = artifacts.require("SkywalkerFungible");
const fs = require("fs");

module.exports = async function (deployer, network) {
  const contractAddressFile = './config/default.json';
  let data = fs.readFileSync(contractAddressFile, 'utf8');
  let jsonData = JSON.parse(data);
  if (!jsonData[network]) {
    console.error('There is no config for: ', network, ', please add.');
    return;
  }

  await deployer.deploy(OmniverseProtocol, jsonData[network].omniverseChainId);
  await deployer.deploy(SkywalkerFungible, "X", "X", "X");
  await deployer.deploy(SkywalkerFungible, "Y", "Y", "Y");

  // Update config
  if (network.indexOf('-fork') != -1 || network == 'test' || network == 'development') {
    return;
  }

  jsonData[network].omniverseProtocolAddress = OmniverseProtocol.address;
  jsonData[network].skywalkerFungibleAddress = SkywalkerFungible.address;
  fs.writeFileSync(contractAddressFile, JSON.stringify(jsonData, null, '\t'));
};
