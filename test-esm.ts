import { authenticator } from 'otplib';
const secret = authenticator.generateSecret();
const token = authenticator.generate(secret);
console.log("Check:", authenticator.check(token, secret));
