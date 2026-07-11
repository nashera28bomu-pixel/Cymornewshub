const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();

console.log('\nAdd these two lines to your .env file (and to Render env vars):\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('\nKeep the private key secret - never commit it or expose it to the frontend.\n');
