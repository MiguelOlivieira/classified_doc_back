import { verifySync, generateSync, generateSecret } from 'otplib';
const secret = generateSecret();
const token = generateSync({ secret, epoch: Date.now() - 30000 }); // token from 30s ago
console.log("verifySync default:", verifySync({ token, secret }));
console.log("verifySync with epoch -30s:", verifySync({ token, secret, epoch: Date.now() - 30000 }));
