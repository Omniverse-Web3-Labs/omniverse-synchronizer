const fs = require('fs');

class stateDB {
    constructor() {
        this.state = {};
    }

    init(path) {
        this.state = JSON.parse(fs.readFileSync(path));
    }

    getValue(key, value = null) {
        return this.state[key] ? this.state[key] : value;
    }

    setValue(key, value) {
        this.state[key] = value;
    }
}

module.exports = new stateDB();