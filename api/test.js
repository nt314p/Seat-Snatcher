const request = require('supertest');
const { isValidSession, login, getName, keepAlive, logout } = require('./logic.js');
require('dotenv').config()

const crypto = require('crypto');
const algorithm = 'aes-256-ctr'
const key = process.env.KEY;
const iv = crypto.createHash('sha512').update(process.env.IV, 'utf-8').digest('hex').substr(0, 16);

function getPassword() {
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(process.env.PASSWORD_ENCRYPTED, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

describe('Login', () => {
    it('should return valid session with correct credentials', async () => {
        const session = await login(process.env.USERNAME, getPassword());
        const isValid = await isValidSession(session);
        expect(isValid);
        await logout(session);
    });

    it('should return invalid session with incorrect credentials', async () => {
        const session = await login(process.env.USERNAME, "wrong_password123");
        const isValid = await isValidSession(session);
        expect(!isValid);
        await logout(session);
    });
});

describe('Logout', () => {
    it('should return invalid session after logout', async () => {
        const session = await login(process.env.USERNAME, getPassword());
        const isValid = await isValidSession(session);
        expect(isValid);
        await logout(session);
        expect(!isValid);
    });
});
