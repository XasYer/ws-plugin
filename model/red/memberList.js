import { sequelize, DataTypes, executeSync } from '../db/base.js'

const member_list_table = sequelize.define('member_list', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    group_id: DataTypes.BIGINT,
    user_id: DataTypes.BIGINT,
    nickname: DataTypes.STRING,
    card: DataTypes.STRING,
    role: DataTypes.INTEGER,
    update_time: DataTypes.BIGINT
})

await sequelize.sync()

/**
 * 根据群号查询所有群员
 * @param {number} group_id 
 * @returns 
 */
async function findAll(group_id) {
    const result = await member_list_table.findAll({
        where: { group_id }
    });
    return result.map(i => {
        return {
            detail: {
                uin: i.dataValues.user_id,
                nick: i.dataValues.nickname,
                cardName: i.dataValues.card,
                role: i.dataValues.role,
                update_time: i.dataValues.update_time
            }
        }
    })
}

/**
 * 根据group_id和user_id查询指定群员
 * @param {number} group_id 
 * @param {number} user_id 
 * @returns 
 */
async function findOne(group_id, user_id) {
    const result = await group_id_table.findOne({
        where: {
            group_id,
            user_id
        }
    })
    return result?.dataValues
}

/**
 * 删除这个群的所有群员
 * @param {number} group_id 
 */
async function deleteAll(group_id) {
    await member_list_table.destroy({
        where: { group_id }
    })
}

/**
 * 删除指定群员
 * @param {number} group_id 
 * @param {number} user_id 
 */
async function deleteOne(group_id, user_id) {
    await member_list_table.destroy({
        where: {
            group_id,
            user_id
        }
    })
}


/**
 * 保存群成员列表,不会判断是否已存在,如果已存在会重复添加
 * @param {Array} data - The array of objects
 * @param {number} data[].group_id - The group ID
 * @param {number} data[].user_id - The user ID
 * @param {string} data[].nickname - The nickname
 * @param {string} data[].card - The card
 * @param {string} data[].role - The role
 * @param {number} data[].update_time - The update time
 */
async function saveMemberList(data) {
    return executeSync(async () => {
        const result = await member_list_table.bulkCreate(data, {
            updateOnDuplicate: ['group_id', 'user_id', 'nickname', 'card', 'role', 'update_time']
        })
        return result?.dataValues
    });
}

export {
    findAll,
    findOne,
    deleteAll,
    deleteOne,
    saveMemberList
}