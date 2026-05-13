const Redis = require('ioredis');
const config = require('../config/system.config');

let redisClient = null;
let hasLoggedReady = false;

const getRedisConnectionOptions = () => ({
    host: config.queue.redisHost,
    port: config.queue.redisPort,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    ...(config.queue.redisPassword ? { password: config.queue.redisPassword } : {}),
});

const getRedisClient = () => {
    if (!redisClient) {
        redisClient = new Redis(getRedisConnectionOptions());
        redisClient.on('ready', () => {
            if (!hasLoggedReady) {
                hasLoggedReady = true;
                console.log('[Redis] Shared Redis connection ready.');
            }
        });
        redisClient.on('error', (error) => {
            console.error('[Redis] Connection error:', error.message);
        });
    }
    return redisClient;
};

const ensureRedisConnection = async () => {
    const client = getRedisClient();
    if (client.status === 'wait') {
        await client.connect();
        return client;
    }
    if (client.status === 'connecting' || client.status === 'connect') {
        await new Promise((resolve, reject) => {
            const onReady = () => {
                client.off('error', onError);
                resolve();
            };
            const onError = (error) => {
                client.off('ready', onReady);
                reject(error);
            };
            client.once('ready', onReady);
            client.once('error', onError);
        });
    }
    return client;
};

module.exports = {
    ensureRedisConnection,
    getRedisClient,
    getRedisConnectionOptions,
};
