const fs = require('fs');
const { execSync } = require("child_process");

module.exports = {
    async inscribe(data) {
        fs.writeFileSync('./.inscription', data);
        // Handle the return value here, confirm that it is executed correctly
        let ret = execSync('ord wallet inscribe --fee-rate 2 .inscription');
        console.log('ret', ret);
    }
}