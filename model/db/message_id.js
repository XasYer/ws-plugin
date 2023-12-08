import { sequelize, DataTypes, Op, existSQL, executeSync } from './base.js'
import schedule from "node-schedule"
import moment from 'moment'

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

async function saveMessage_id({ message_id, seq, rand, time, user_id, group_id, onebot_id }) {
    return executeSync(async () => {
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
        });
        return result?.dataValues;
    });
}

async function findMessage_id(where, order = [['createdAt', 'DESC']]) {
    return executeSync(async () => {
        const result = await message_id_table.findOne({
            where,
            order,
        })
        if (result?.dataValues) {
            result.dataValues.createdAt = moment(result.dataValues.createdAt).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
            result.dataValues.updatedAt = moment(result.dataValues.updatedAt).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
        }
        return result?.dataValues
    });
}

if (existSQL) {
    const job = schedule.scheduleJob('0 30 0 * * ?', async function () {
        await executeSync(async () => {
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
        });
    })
}


export {
    saveMessage_id,
    findMessage_id
}