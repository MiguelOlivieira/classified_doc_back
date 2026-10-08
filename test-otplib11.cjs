const otplib = require('otplib');
const authenticator = otplib.authenticator;
authenticator.options = { window: 2 };
const secret = authenticator.generateSecret();
const t2 = otplib.generateSync({ secret, epoch: Date.now() - 60000 });
console.log("authenticator.check:", authenticator.check(t2, secret));
