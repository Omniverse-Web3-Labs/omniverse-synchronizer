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
    MainLogger.info('Init chainHandlerMgr');
    let networks = config.get('networks');
    for (let i in networks) {
      let network = networks[i];
      let handler = require('./' + network['compatibleChain'] + '/index');
      let inst = new handler(i);
      this.chainHandlers[network.omniverseChainId] = inst;
      await inst.init(this);
    }
  }

  getHandlerByName(name_) {
    if (this.chainHandlers[name_] == null) {
      let stack = new Error().stack;
      MainLogger.error(
        utils.format('Chain handler {0} can not be found, {1}', name_, stack)
      );
    }
    return this.chainHandlers[name_];
  }

  getMessageWaitingChain(from, nonce, tokenId) {
    return this.messageObserver[from + nonce + tokenId];
  }

  onMessageSent(chainId, message, members, tokenId) {
    MainLogger.debug('Message sent', chainId, message, members, tokenId);
    if (this.messageObserver[message.from + message.nonce + tokenId]) {
      return false;
    }
    MainLogger.info('Add to message observer', message.from, message.nonce, tokenId);

    let task = {
      fromChain: chainId,
      members: members,
      taskMembers: [],
    };
    for (let j in members) {
      if (chainId != members[j].chainId) {
        if (this.chainHandlers[members[j].chainId]) {
          this.chainHandlers[members[j].chainId].addMessageToList(
            message,
            tokenId
          );
          task.taskMembers.push(members[j].chainId);
        }
      }
    }
    if (task.taskMembers.length > 0) {
      this.messageObserver[message.from + message.nonce + tokenId] = task;
      return true;
    } else {
      return false;
    }
  }

  onMessageExecuted(chainId, from, nonce, tokenId) {
    let task = this.messageObserver[from + nonce + tokenId];
    if (!task) {
      MainLogger.error('This case should not appear');
      return;
    }

    if (chainId == task.fromChain) {
      MainLogger.info('Executed on original chain');
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
      MainLogger.info(utils.format('Task for {0} not exists', chainId));
    }

    if (task.taskMembers.length == 0) {
      for (let i in this.chainHandlers) {
        this.chainHandlers[i].messageFinalized(from, nonce, tokenId);
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
      pushMessageRequest.push(this.chainHandlers[i].pushMessages(this));
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
      updateRequest.push(this.chainHandlers[i].update(this));
    }
    await Promise.all(updateRequest);
  }

  async restore() {
    MainLogger.info('restore');
    if (config.has('database') && config.get('database')) {
      for (let i in this.chainHandlers) {
        await this.chainHandlers[i].beforeRestore();
      }
      try {
        let res = request('GET', config.get('database'));
        if (res && res.statusCode == 200) {
          let body = res.getBody();
          let pendings = JSON.parse(body);
          if (pendings.code != 0) {
            MainLogger.error('Restore failed', pendings.message);
            return;
          }
          for (let i in this.chainHandlers) {
            await this.chainHandlers[i].restore(pendings.message, this);
          }
        } else {
          MainLogger.info('Result error', res);
        }
      } catch (err) {
        MainLogger.error('connect refuse: ', err.message);
      }
    } else {
      MainLogger.info('Database not configured');
    }
  }
}

let mgr = new chainHandlerMgr();
module.exports = mgr;
