const otplib = require('otplib');
const secret = otplib.generateSecret();
const t2 = otplib.generateSync({ secret, epoch: Date.now() - 30000 }); // token from 30s ago

let isValid = false;
for (let i = -1; i <= 1; i++) {
  const result = otplib.verifySync({ token: t2, secret: secret, epoch: Date.now() + (i * 30000) });
  if (result.valid) { isValid = true; break; }
}

console.log("isValid for token from 30s ago:", isValid);
