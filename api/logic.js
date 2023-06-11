const axios = require('axios');
require('dotenv').config();
const { createHash } = require('crypto');

const baseUrl = process.env.BASE_URL;
const classDataApi = baseUrl + "/getclassdata.jsp";
const termId = "3202320";

async function login(username, password) {
    const response = await axios.post(
        baseUrl + '/login.jsp',
        { word1: username, word2: password, login: "" },
        {
            maxRedirects: 0,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', },
            validateStatus: () => true
        });

    return parseSession(response);
}

async function logout(sessionId) {
    await getUrl(baseUrl + '/login.jsp?logout=link', sessionId);
}

async function keepAlive(sessionId) {
    const response = await getUrl(baseUrl + `/realtime.jsp?_=${Date.now()}`, sessionId);

    // we assume that if there is no setcookie for the session,
    // the session was extended successfully
    let resSessionId = parseSession(response);
    if (resSessionId == null) return true;

    return sessionId.toLowerCase() == resSessionId.toLowerCase();
}

// Determines whether the jsessionId is valid
async function isValidSession(sessionId) {
    if (sessionId == null) return false;
    const result = await getAcademicPlans(sessionId);
    return result !== null;
}

// Fetches the base url if the correct answer to a prompt is given
function getBaseUrl(promptResponse) {
    promptResponse = promptResponse.toLowerCase();
    if (promptResponse.indexOf(process.env.PROMPT_RESPONSE) === 0) 
        return process.env.BASE_URL;
    
    return "";
}

// Fetches academic plans (currently used for session validation)
async function getAcademicPlans(sessionId) {
    const response = await getUrl(
        baseUrl + `/api/getAcademicPlans?term=${termId}`, sessionId);

    const plans = response.data[0];
    if (plans === undefined) return null;
    return plans;
}

// RIPPP 17.51 kB of data just to extract the user's name...
async function getName(sessionId) {
    const response = await getUrl(baseUrl + '/criteria.jsp', sessionId);

    const html = response.data;

    if (html.indexOf("Not Authenticated") !== -1) return null;

    const startString = '<span class="autho_text header_invader_text_top">';
    const startIndex = html.indexOf(startString);
    let trimmed = html.substring(startIndex + startString.length);
    trimmed = trimmed.substring(0, trimmed.indexOf('</span>')).trim();

    return trimmed;
}

async function getClassDataXml(courseName) {
    let classUrl = getClassUrl(courseName);

    const response = await axios.get(classUrl);
    return response.data;
}

// TODO: we can spam a bunch of classes as params to get higher throughput
function getClassUrl(courseName) {
    const authParams = getAuthParams();

    let url = classDataApi + "?term=" + termId;
    url += `&course_0_0=${courseName}`;
    url += `&t=${authParams.t}&e=${authParams.e}`;
    return url;
}

// Fetches a url with the JSESSIONID cookie set
async function getUrl(url, sessionId) {
    return await axios.get(url, {
        headers: { Cookie: `JSESSIONID=${sessionId}` }
    });
}

function hashName(name) {
    return createHash('sha256').update(name).digest('hex');
}

// Parses the session id out of a response object
function parseSession(response) {
    let cookie = response.headers['set-cookie'];
    if (cookie === undefined) return null;
    cookie = cookie[0];

    return cookie.substring(cookie.indexOf('=') + 1, cookie.indexOf(';'));
}

function getAuthParams() {
    const t = (Math.floor((new Date()) / 60000)) % 1000;
    const e = t % 39 + + t % 42 + t % 3;
    return { t, e };
}

function parseCourse(root) {
    let course = {};

    course.code = root.$.key;
    course.title = root.offering[0].$.title;
    course.description = root.offering[0].$.desc;
    course.blocks = [];
    course.lectures = [];
    course.tutorials = [];
    course.labs = [];

    // root.uselection is an array of objects representing every possible combination
    // of classes that can be taken for that course (lec, lab, tut, etc.)
    // we add all courses to our blocks (some are duplicates that differ only by the timeblockid)
    let addedBlockIds = [];

    root.uselection.forEach(uselection => {
        uselection.selection.forEach(selection => {
            let blocks = selection.block;

            // the cartid property can be used as an id
            // we only add blocks with unique ids. this however ignores that
            // blocks are unique by their timeblockid
            for (let i = 0; i < blocks.length; i++) {
                let block = blocks[i].$;
                if (addedBlockIds.includes(block.cartid)) continue;
                course.blocks.push(block);
                addedBlockIds.push(block.cartid);
            }
        });
    });

    // Reorganize blocks
    for (let i = 0; i < course.blocks.length; i++) {
        let block = course.blocks[i];
        course.blocks[i] = processBlock(block);
    }

    course.blocks.forEach(block => {
        switch (block.type) {
            case "LEC":
                course.lectures.push(block);
                break;
            case "TUT":
                course.tutorials.push(block);
                break;
            case "LAB":
                course.labs.push(block);
                break;
            default: {
                console.log("Course type did not match LEC/TUT/LAB!");
                course.lectures.push(block);
            }
        }
    });

    course.blocks = undefined;
    return course;
}

// Removes and renames properties for clarity
function processBlock(block) {
    let newBlock = {};
    newBlock.type = block.type;
    newBlock.cartId = block.cartid;
    newBlock.sectionNumber = block.secNo;
    newBlock.maximumEnrollment = block.me;
    newBlock.openSeats = block.os;
    newBlock.waitlistCapacity = block.wc;
    newBlock.waitlistSeats = block.ws;
    newBlock.displayName = block.disp;
    newBlock.teacher = block.teacher;
    newBlock.location = block.location;
    newBlock.instructionMode = block.im;
    return newBlock;
}

module.exports = {
    isValidSession, login, getName, keepAlive,
    logout, getClassDataXml, parseCourse, hashName,
    getBaseUrl
};