'use strict';
const config = require('config');
const request = require('sync-request');

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
        if (this.messageObserver[message.from + message.nonce]) {
            return;
        }

        let task = {
            fromChain: chainId,
            members: members,
            taskMembers: [],
        }
        for (let j in members) {
            if (chainId != members[j].chainId) {
                if (this.chainHandlers[members[j].chainId]) {
                    this.chainHandlers[members[j].chainId].addMessageToList(message);
                    task.taskMembers.push(members[j].chainId);
                }
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
            for (let i in this.chainHandlers) {
                this.chainHandlers[i].messageFinalized(from, nonce);
            }
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
        let pushMessageRequest = [];
        for (let i in this.chainHandlers) {
            pushMessageRequest.push(this.chainHandlers[i].pushMessages());
        }
        await Promise.all(pushMessageRequest);
    }

    async tryTrigger() {
        let triggerRequest = [];
        for (let i in this.chainHandlers) {
            triggerRequest.push(this.chainHandlers[i].tryTrigger());
        }
        await Promise.all(triggerRequest);
    }

    async update() {
        let updateRequest = [];
        for (let i in this.chainHandlers) {
            updateRequest.push(this.chainHandlers[i].update());
        }
        await Promise.all(updateRequest);
    }

    async restore() {
      if (config.has('database') && config.get('database')) {
        for (let i in this.chainHandlers) {
            await this.chainHandlers[i].beforeRestore();
        }

        let res = request('GET', config.get("database"));
        if (res && res.statusCode == 200) {
          let body = res.getBody();
          let pendings = JSON.parse(body);
          for (let i = 0; i < pendings.length; i++) {
            for (let i in this.chainHandlers) {
                await this.chainHandlers[i].restore();
            }
          }
        }
        else {
            global.logger.info('Result error', res);
        }
      }
      else {
        global.logger.info('Database not configured');
      }
    }
}

let mgr = new chainHandlerMgr();
module.exports = mgr;