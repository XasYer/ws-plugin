import { sequelize, DataTypes, executeSync, Op } from './base.js'

const group_id_table = sequelize.define('group_id', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    group_id: DataTypes.STRING,
    custom: DataTypes.BIGINT
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
    if (where.custom) {
        where = {
            [Op.or]: [
                { id: where.custom },
                { custom: where.custom }
            ],
            group_id: (() => {
                if (Array.isArray(where.like)) {
                    return {
                        [Op.or]: where.like.map(i => i = { [Op.like]: i })
                    }
                } else {
                    return {
                        [Op.like]: where.like || '%'
                    }
                }
            })()
        }
    }
    return executeSync(async () => {
        const result = await group_id_table.findOne({
            where,
            order,
        })
        return result?.dataValues
    });
}

async function updateGroup_id(where, custom) {
    return executeSync(async () => {
        const result = await group_id_table.update({
            custom: custom
        }, {
            where
        });
        return result;
    });
}


export {
    group_id_table,
    saveGroup_id,
    findGroup_id,
    updateGroup_id
}