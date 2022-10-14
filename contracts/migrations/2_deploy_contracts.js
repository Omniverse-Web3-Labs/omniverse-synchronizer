const OmniverseProtocol = artifacts.require("OmniverseProtocol");
const SkywalkerFungible = artifacts.require("SkywalkerFungible");

module.exports = async function (deployer) {
  await deployer.deploy(OmniverseProtocol, 'ETHEREUM');
  await deployer.deploy(SkywalkerFungible, "Skywalker", "SW", "SW");
};
