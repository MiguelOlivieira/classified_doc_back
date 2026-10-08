const otplib = require('otplib');
try {
  const secret = otplib.generateSecret();
  const token = otplib.generateSync({ secret, date: Date.now(), algorithm: 'sha1', digits: 6, step: 30 });
  console.log("Generated token:", token);
  
  const result = otplib.verifySync({ token, secret, epochTolerance: 30, step: 30 });
  console.log("verifySync result:", result);
} catch(e) {
  console.error(e);
}
