import { sequelize, DataTypes, executeSync, Op } from './base.js'
import moment from 'moment'

let user_id_table = sequelize.define('user_id', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: DataTypes.STRING,
})

await sequelize.sync()

async function checkColumn() {
    const attributes = await sequelize.queryInterface.describeTable('user_ids')
    if (!attributes.custom) {
        await sequelize.queryInterface.addColumn('user_ids', 'custom', {
            type: DataTypes.BIGINT,
        })
    } else {
        // 我操 为什么要用String类型定义QQ
        await sequelize.queryInterface.changeColumn('user_ids', 'custom', {
            type: DataTypes.BIGINT,
        })
    }
    user_id_table = sequelize.define('user_id', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: DataTypes.STRING,
        custom: DataTypes.BIGINT
    })
    await sequelize.sync()
}
await checkColumn()

async function saveUser_id(user_id) {
    return executeSync(async () => {
        const result = await user_id_table.create({
            user_id
        }, {
            returning: true
        });
        return result?.dataValues
    });
}

async function findUser_id(where, order = [['createdAt', 'DESC']]) {
    if (where.custom) {
        where = {
            [Op.or]: [
                { id: where.custom },
                { custom: where.custom }
            ],
            user_id: {
                [Op.like]: where.like || '%'
            }
        }
    }
    return executeSync(async () => {
        const result = await user_id_table.findOne({
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

async function updateUser_id(where, custom) {
    return executeSync(async () => {
        const result = await user_id_table.update({
            custom: custom
        }, {
            where
        });
        return result;
    });
}

export {
    saveUser_id,
    findUser_id,
    updateUser_id
}