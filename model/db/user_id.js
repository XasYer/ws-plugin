import { sequelize, DataTypes, executeSync } from './base.js'

const user_id_table = sequelize.define('user_id', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: DataTypes.STRING,
})

await sequelize.sync()

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
    return executeSync(async () => {
        const result = await user_id_table.findOne({
            where,
            order,
        })
        return result?.dataValues
    });
}


export {
    saveUser_id,
    findUser_id
}