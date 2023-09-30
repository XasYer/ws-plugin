import { sequelize, DataTypes, Op, existSQL } from './base.js'
import schedule from "node-schedule"

const message_id_table = sequelize.define('message_id', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    message_id: {
        type: DataTypes.STRING,
        unique: true
    },
    seq: DataTypes.INTEGER,
    rand: DataTypes.BIGINT,
    time: DataTypes.BIGINT,
    user_id: DataTypes.BIGINT,
    group_id: DataTypes.BIGINT,
    onebot_id: DataTypes.INTEGER,
})


await sequelize.sync()

let lock = Promise.resolve()

async function setMessage_id({ message_id, seq, rand, time, user_id, group_id, onebot_id }) {
    let _lock = lock
    lock = new Promise((resolve, reject) => {
        _lock.then(async () => {
            try {
                const [result, created] = await message_id_table.upsert({
                    message_id,
                    seq,
                    rand,
                    time,
                    user_id,
                    group_id,
                    onebot_id
                }, {
                    returning: true
                })
                resolve(result?.dataValues)
            } catch (error) {
                reject(error)
            }
        })
    })

    return await lock
}

async function getMessage_id(where, order = [['createdAt', 'DESC']]) {
    let _lock = lock

    lock = new Promise((resolve, reject) => {
        _lock.then(async () => {
            try {
                const result = await message_id_table.findOne({
                    where,
                    order,
                })
                resolve(result?.dataValues)
            } catch (error) {
                reject(error)
            }
        })
    })
    return await lock
}
if (existSQL) {
    const job = schedule.scheduleJob('0 30 0 * * ?', async function () {
        let _lock = lock

        lock = new Promise((resolve, reject) => {
            _lock.then(async () => {
                try {
                    const staleData = new Date()
                    // TODO 自定义存储时间
                    staleData.setDate(staleData.getDate() - 7)

                    await message_id_table.destroy({
                        where: {
                            createdAt: {
                                [Op.lt]: staleData
                            }
                        }
                    })
                    await sequelize.query('VACUUM');
                    resolve()
                } catch (error) {
                    reject(error)
                }
            })
        })

        await lock
    })
}


export {
    setMessage_id,
    getMessage_id
}