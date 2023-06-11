const { isValidSession, login, getName, getBaseUrl, logout } = require('./logic.js');
require('dotenv').config()

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

describe('Login', () => {
    let session, isValidAfterLogin, isValidAferLogout, fullName;

    beforeAll(async () => { // Jest forced my hand with this very cursed testing layout
        session = await login(process.env.USERNAME_API, getPassword());
        isValidAfterLogin = await isValidSession(session);
        fullName = await getName(session);
        await logout(session);
        isValidAferLogout = await isValidSession(session);
    });

    it('should return valid session with correct credentials', () => {
        return expect(isValidAfterLogin).toBeTruthy();
    });

    it('should return correct name after login', () => {
        return expect(fullName).toBe(process.env.FULL_NAME);
    });

    it('should return invalid session after logout', () => {
        return expect(isValidAferLogout).toBeFalsy();
    });

    it('should return no name with invalid session', () => {
        return expect(getName("invalid_session")).resolves.toBeNull();
    });
});

describe('Base url fetch', () => {
    it('should return base url given correct prompt response', () => {
        expect(getBaseUrl(process.env.PROMPT_RESPONSE)).toBe(process.env.BASE_URL);
    });
    
    it('should return empty string given incorrect prompt response', () => {
        expect(getBaseUrl("invalid response")).toBe("");
    });
});
