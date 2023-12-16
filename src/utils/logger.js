const log4js = require('log4js');
const config = require('config');
const defaultConfig = config.get('networks');

let configure = {
	appenders: {
		fileout: { type: 'file', filename: 'fileout.log' },
		consoleout: { type: 'stdout' }
	},
	categories: {
		default: { appenders: ['consoleout'], level: 'off'},
		main: { appenders: ['fileout', 'consoleout'], level: 'all' }
	}
};

for (let chainName in defaultConfig) {
	chainName = chainName.toLowerCase();
	configure.appenders[chainName] = {
		type: 'file',
		filename: `logs/${chainName}.log`,
	};
	configure.categories[chainName] = {
		appenders: [chainName, 'consoleout'],
		level: 'all',
	};
}

log4js.configure(configure);

module.exports = log4js;