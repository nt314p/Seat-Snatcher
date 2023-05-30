const { getName, hashName } = require('./logic.js');

require('dotenv').config()

const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    nameHash: String, // the hash of the user's full name; used for id purposes
    sessionId: String,
    courseCode: String,
    timeBlockId: Number,  // index which uniquely defines the classes to enroll in

    // emrollmentAttempts is incremented if the enrollment fails for a reason
    // other than a full course. For example, if you do not meet the prerequisites,
    // the service will not spam the enrollment just because there are open seats
    enrollmentAttempts: Number,
});

const User = mongoose.model('User', userSchema);

main().catch(err => console.log(err));

async function main() {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Connected to database!");
    await User.create({ nameHash: hashName(process.env.FULL_NAME) });
    console.log(await hasUser(""));
}

async function hasUser(sessionId) {
    const fullName = await getName(sessionId);
    if (fullName == null) return false;
    const hash = hashName(fullName);
    const user = await User.exists({ nameHash: hash });
    return user != null;
}