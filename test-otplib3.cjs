const otplib = require('otplib');
try {
  const secret = otplib.generateSecret();
  const token = "000000"; // Fake token
  
  const result = otplib.verifySync({ token, secret, window: 1 });
  console.log("verifySync fake token:", result);
} catch(e) {
  console.error(e);
}
