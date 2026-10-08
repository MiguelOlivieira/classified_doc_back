const Redis = require('ioredis');

async function test() {
  const redisUrl = "rediss://default:gQAAAAAABFZAAAIgcDE1YjhiYjI1MjUzZWM0MGVjOTQ1MTFkMGM5ZmE4MjRmYw@healthy-stud-284224.upstash.io:6379";
  const redis = new Redis(redisUrl);
  
  const val = await redis.get('user-2fa:usr-001');
  console.log("Redis user-2fa:usr-001 =", val);
  
  const val2 = await redis.get('user-2fa:usr-admin-001');
  console.log("Redis user-2fa:usr-admin-001 =", val2);
  
  process.exit(0);
}

test();
