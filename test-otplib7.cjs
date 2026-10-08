const otplib = require('otplib');
const secret = otplib.generateSecret();
const t1 = otplib.generateSync({ secret });
const t2 = otplib.generateSync({ secret, epoch: Date.now() - 120000 });
console.log("t1:", t1);
console.log("t2 (-120s):", t2);
console.log("verify t2:", otplib.verifySync({ token: t2, secret, epochTolerance: 0 }));
