'use strict';
const config = require('config');

class chainHandlerMgr {
    constructor() {
        this.chainHandlers = {};
        /* After a message is initiated, and transported across all the Omniverse DLT,
        we must trace the executing result on each chain
        */
        this.messageObserver = {};
    }

    async init() {
        logger.info("Init chainHandlerMgr");
        let networks = config.get('networks');
        for (let i in networks) {
            let network = networks[i];
            let handler = require('./' + network['compatibleChain'] + '/index');
            let inst = new handler(i);
            this.chainHandlers[network.omniverseChainId] = inst;
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

    onMessageSent(chainId, message, members) {
        let task = {
            fromChain: chainId,
            members: members,
            taskMembers: [],
        }
        for (let j in members) {
            if (chainId != members[j].chainId) {
                this.chainHandlers[members[j].chainId].addMessageToList(message);
                task.taskMembers.push(members[j].chainId);
            }
        }
        this.messageObserver[message.from + message.nonce] = task;
    }

    onMessageExecuted(chainId, from, nonce) {
        let task = this.messageObserver[from + nonce];
        if (!task) {
            logger.error('This case should not appear');
            return;
        }

        if (chainId == task.fromChain) {
            logger.info('Executed on original chain');
            return;
        }

        let found = false;
        for (let i = 0; i < task.taskMembers.length; i++) {
            if (task.taskMembers[i] == chainId) {
                task.taskMembers.splice(i, 1);
                found = true;
                break;
            }
        }

        if (!found) {
            logger.error(utils.format('Task for {0} not exists', chainId));
        }

        if (task.taskMembers.length == 0) {
            this.chainHandlers[task.fromChain].messageFinalized(from, nonce);
        }
    }

    async run() {
        for (let i in this.chainHandlers) {
            await this.chainHandlers[i].start(this);
        }
    }

    async loop() {
        await this.pushMessages();
        await this.tryTrigger();
        await this.update();
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

    async update() {
        for (let i in this.chainHandlers) {
            await this.chainHandlers[i].update();
        }
    }
}

let mgr = new chainHandlerMgr();
module.exports = mgr;