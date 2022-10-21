const OmniverseProtocol = artifacts.require("OmniverseProtocol");
const SkywalkerFungible = artifacts.require("SkywalkerFungible");

module.exports = async function (deployer) {
  await deployer.deploy(OmniverseProtocol, 'ETHEREUM');
  await deployer.deploy(SkywalkerFungible, "Skywalker", "SW", "SW");

  // Update config
  if (network.indexOf('-fork') != -1 || network == 'test') {
    return;
  }

  const contractAddressFile = './config/default.json';
  let data = fs.readFileSync(contractAddressFile, 'utf8');
  let jsonData = JSON.parse(data);
  if (!jsonData[network]) {
    console.warn('There is no config for: ', network, ', please add.');
    jsonData[network] = {};
  }

  jsonData[network].omniverseProtocolAddress = OmniverseProtocol.address;
  jsonData[network].skywalkerFungibleAddress = SkywalkerFungible.address;
  fs.writeFileSync(contractAddressFile, JSON.stringify(jsonData, null, '\t'));
};
