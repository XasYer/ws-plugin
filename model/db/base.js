import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url'

let Sequelize, DataTypes, sequelize, Op, existSQL = true
try {
    const modules = await import('sequelize');
    Sequelize = modules.Sequelize;
    DataTypes = modules.DataTypes;
    Op = modules.Op

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: resolve(__dirname, 'data.db'),
        logging: false,
    })

    await sequelize.authenticate()
} catch (error) {
    logger.warn('[ws-plugin] Yunzai-Bot暂不支持sqlite3数据库,建议切换至Miao-Yunzai获得最佳体验')
    existSQL = false
    sequelize = new Proxy({}, {
        get: () => {
            return () => {
                return new Promise((resolve, reject) => {
                    resolve();
                });
            }
        },
    });
    DataTypes = {};
}

let lock = Promise.resolve()
let shouldCancel = false;

function executeSync(callback) {
    let _lock = lock;

    lock = new Promise((resolve, reject) => {
        _lock.then(async () => {
            if (shouldCancel) {
                reject('Cancelled');
                return;
            }
            try {
                const result = await callback();
                resolve(result);
            } catch (error) {
                logger.error('[ws-plugin] callback', error)
                reject(error);
            }
        }).catch(error => {
            logger.error('[ws-plugin] promise', error);
        });
    });

    return lock;
}


function resetLock() {
    shouldCancel = true;
    lock = Promise.resolve();
}

export {
    sequelize,
    DataTypes,
    Op,
    existSQL,
    executeSync,
    resetLock
}