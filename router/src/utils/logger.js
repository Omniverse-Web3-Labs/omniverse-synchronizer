const log4js = require('log4js');

log4js.configure({
	appenders: {
		fileout: { type: 'file', filename: 'fileout.log' },
		consoleout: { type: 'stdout' }
	},
	categories: {
		default: { appenders: ['consoleout'], level: 'off'},
		anything: { appenders: ['fileout', 'consoleout'], level: 'all' }
	}
});

module.exports = log4js.getLogger('anything');