const { isValidSession, login } = require('./logic.js');

const crypto = require('crypto');
const algorithm = 'aes-256-ctr'
const key = process.env.KEY;
const iv = crypto.createHash('sha512')
    .update(process.env.IV + process.env.USERDOMAIN, 'utf-8').digest('hex').substring(0, 16);

function getPassword() {
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(process.env.PASSWORD_ENCRYPTED, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

login(process.env.USERNAME_API, getPassword()).then(async session => {
    console.log(`Began at ${Date.now()}`);
    while (true) {
        await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 15));
        let isAlive = await isValidSession(session);
        if (isAlive) {
            console.log(`Was alive at ${Date.now()}`);
        } else {
            console.log(`Expired at ${Date.now()}`);
        }
    }
});