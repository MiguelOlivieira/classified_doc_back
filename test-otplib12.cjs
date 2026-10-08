const { authenticator } = require('otplib');
const secret = authenticator.generateSecret();
const t2 = authenticator.generate(secret); // current
const tOld = require('otplib').generateSync({ secret, epoch: Date.now() - 30000 }); // 30s ago (previous step)

console.log("authenticator.check t2 (now):", authenticator.check(t2, secret));
console.log("authenticator.check tOld (30s ago):", authenticator.check(tOld, secret));

authenticator.options = { window: 2 };
console.log("authenticator.check tOld2 (60s ago):", authenticator.check(require('otplib').generateSync({ secret, epoch: Date.now() - 60000 }), secret));
