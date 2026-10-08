const otplib = require('otplib');
const secret = otplib.generateSecret();
const t1 = otplib.authenticator.generate(secret);
const t2 = otplib.generateSync({ secret, date: Date.now() - 120000 });
console.log("authenticator.generate:", t1);
console.log("generateSync -120s:", t2);
