'use strict';
const config = require('config');

class chainHandlerMgr {
    constructor() {
        this.chainHandlers = {};
    }

    async init() {
        logger.info("Init chainHandlerMgr");
        let networks = config.get('networks');
        for (let i in networks) {
            let network = networks[i];
            let handler = require('./' + network['compatibleChain'] + '/index');
            let inst = new handler(i);
            this.chainHandlers[i] = inst;
            await inst.init();
        }
    }

    getHandlerByName(name_) {
        if (this.chainHandlers[name_] == null) {
            let stack = new Error().stack;
            logger.error(utils.format('Chain handler {0} can not be found, {1}', name_, stack));
        }
        return this.chainHandlers[name_];
    }

    run() {
        for (let i in this.chainHandlers) {
            this.chainHandlers[i].start(function(message, members) {
                for (let j in members) {
                    this.chainHandlers[j].addMessageToList(message);
                }
            });
        }
    }

    async loop() {
        await this.pushMessages();
        await this.tryTrigger();
    }

    async pushMessages() {
        for (let i in this.chainHandlers) {
            await this.chainHandlers[i].pushMessages();
        }        
    }

    async tryTrigger() {
        for (let i in this.chainHandlers) {
            await this.chainHandlers[i].tryTrigger();
        }
    }
}

let mgr = new chainHandlerMgr();
module.exports = mgr;