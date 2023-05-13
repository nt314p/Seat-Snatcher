const express = require('express');
const axios = require('axios');
const xml = require('xml2js');
const path = require('path');
const app = express();

require('dotenv').config()

const port = process.env.PORT || 4000;

const classDataApi = process.env.BASE_URL + "/getclassdata.jsp";
const termId = "3202320";

app.use('/api/course/:courseName/raw', async (req, res) => {
    const courseName = req.params.courseName;
    const xmlData = await getClassDataXml(courseName);

    res.send(xmlData);
});

app.use('/api/course/:courseName', async (req, res) => {
    const courseName = req.params.courseName;
    const xmlData = await getClassDataXml(courseName);
    const result = await xml.parseStringPromise(xmlData);

    const errors = result.addcourse.errors;

    if (errors.length > 0 && errors[0].error !== undefined) {
        const error = errors[0].error[0];
        const notOfferedInTermPhrase = "is only available";
        const notFoundPhrase = "could not be found in any";

        let statusCode = 400;
        if (error.includes(notOfferedInTermPhrase)) statusCode = 200;
        if (error.includes(notFoundPhrase)) statusCode = 404;

        res.status(statusCode).json({ "error": error });
        return;
    }

    const root = result.addcourse.classdata[0].course[0];

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

    res.status(200).json({ course });
});

app.use('/', express.static(path.join(__dirname, "../static")));

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

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

function getAuthParams() {
    const t = (Math.floor((new Date()) / 60000)) % 1000;
    const e = t % 39 + + t % 42 + t % 3;
    return { t, e };
}