const otplib = require('otplib');
const secret = "ZVSKHTLWHMM6OCHSD2MJGAD7TVR4AHTN";
const token = otplib.generateSync({ secret });
console.log("CURRENT TOKEN:", token);
