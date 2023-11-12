import { sequelize, DataTypes, executeSync } from './base.js'

const group_id_table = sequelize.define('group_id', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    group_id: DataTypes.STRING,
})

await sequelize.sync()

async function saveGroup_id(group_id) {
    return executeSync(async () => {
        const result = await group_id_table.create({
            group_id
        }, {
            returning: true
        });
        return result?.dataValues
    });
}

async function findGroup_id(where, order = [['createdAt', 'DESC']]) {
    return executeSync(async () => {
        const result = await group_id_table.findOne({
            where,
            order,
        })
        return result?.dataValues
    });
}


export {
    saveGroup_id,
    findGroup_id
}