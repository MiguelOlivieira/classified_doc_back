const otplib = require('otplib');
const secret = otplib.generateSecret();
const t2 = otplib.generateSync({ secret, epoch: Date.now() - 60000 });
console.log("verify window:1:", otplib.verifySync({ token: t2, secret, window: 1 }));
console.log("verify epochTolerance:60:", otplib.verifySync({ token: t2, secret, epochTolerance: 60 }));
console.log("verify window:2:", otplib.verifySync({ token: t2, secret, window: 2 }));
