const otplib = require('otplib');
const secret = otplib.generateSecret();
// generate with epoch in SECONDS
const epochInSeconds = Math.floor(Date.now() / 1000);
const t2 = otplib.generateSync({ secret, epoch: epochInSeconds - 30 }); // 30 seconds ago
console.log("verifySync default (no tolerance):", otplib.verifySync({ token: t2, secret }));
console.log("verifySync epochTolerance 30:", otplib.verifySync({ token: t2, secret, epochTolerance: 30 }));
