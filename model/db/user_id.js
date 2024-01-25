import { sequelize, DataTypes, executeSync, Op } from './base.js'

let user_id_table = sequelize.define('user_id', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: DataTypes.STRING,
    custom: DataTypes.BIGINT
})

await sequelize.sync({ alert: true })

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