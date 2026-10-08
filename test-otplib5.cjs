const otplib = require('otplib');
try {
  const secret = otplib.generateSecret();
  const token = otplib.generateSync({ secret, date: Date.now() - 120000 });
  const result1 = otplib.verifySync({ token, secret, epochTolerance: 0 });
  console.log("verifySync epochTolerance:0 120s ago result:", result1);
} catch(e) {
  console.error(e);
}
