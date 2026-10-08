const otplib = require('otplib');
const secret = "XPH563HQ6GJAXBXS2WIVLKFNRJFPXTVD";
const token = otplib.generateSync({ secret });
console.log("CURRENT TOKEN:", token);
