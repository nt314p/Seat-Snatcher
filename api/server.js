const express = require('express');
const xml = require('xml2js');
const path = require('path');
const {isValidSession, login, getName, keepAlive, logout, getClassDataXml, parseCourse } = require('./logic.js');
const app = express();

require('dotenv').config()

const port = process.env.PORT || 4000;

app.use('/api/validateSession/:session', async (req, res) => {
    const result = await isValidSession(req.params.session);
    res.send(result);
});

app.use('/api/test', async (req, res) => {
    const session = await login("username", "password");
    const name = await getName(session);
    const isValid = await isValidSession(session);
    const keptAlive = await keepAlive(session);
    await logout(session);
    const afterLogoutIsValid = await isValidSession(session);

    res.send({ name, session, keptAlive, isValid, afterLogoutIsValid });
});

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
    const course = parseCourse(root);

    res.status(200).json({ course });
});

app.use('/', express.static(path.join(__dirname, "../static")));

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});