const otplib = require('otplib');
try {
  const secret = otplib.generateSecret();
  // Generate a token for 60 seconds ago
  const token = otplib.generateSync({ secret, date: Date.now() - 60000 });
  console.log("Generated token 60s ago:", token);
  
  const result1 = otplib.verifySync({ token, secret, epochTolerance: 0 });
  console.log("verifySync epochTolerance:0 result:", result1);
  
  const result2 = otplib.verifySync({ token, secret, epochTolerance: 60 });
  console.log("verifySync epochTolerance:60 result:", result2);
} catch(e) {
  console.error(e);
}
