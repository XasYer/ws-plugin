import { Config } from "../components/index.js"
import { saveMessage_id, findMessage_id, existSQL, findUser_id, saveUser_id, findGroup_id, saveGroup_id } from './db/index.js'

let latestMsg = null

let guildLatestMsgId = {}
let QQBotLatestReply = {}

async function getMsg(where, other) {
    if (existSQL) {
        const msg = await findMessage_id(where, other)
        return msg
    } else {
        let key = where.onebot_id || where.message_id
        let msg = await redis.get(`Yz:ws-plugin:msg:${key}`)
        if (!msg) {
            return null
        }
        return JSON.parse(msg)
    }
}

async function setMsg(value) {
    if (existSQL) {
        await saveMessage_id(value)
    } else {
        const EX = Config.msgStoreTime
        if (EX > 0) {
            await redis.set(`Yz:ws-plugin:msg:${value.onebot_id}`, JSON.stringify(value), { EX })
            await redis.set(`Yz:ws-plugin:msg:${value.message_id}`, JSON.stringify(value), { EX })
        }
    }
    latestMsg = value
}

function getLatestMsg() {
    return latestMsg
}

function getGuildLatestMsgId(guild_id) {
    return guildLatestMsgId[guild_id]
}

function setGuildLatestMsgId(message_id, guild_id) {
    guildLatestMsgId[guild_id] = message_id
}

function getQQBotLateseReply(group_id) {
    return QQBotLatestReply[group_id]
}

function setQQBotLateseReply(reply, group_id) {
    QQBotLatestReply[group_id] = reply
}

async function getUser_id(where) {
    if (where.user_id) {
        if (!isNaN(Number(where.user_id))) {
            return Number(where.user_id)
        }
        where.user_id = String(where.user_id)
    }
    let data = await findUser_id(where)
    if (!data) data = await saveUser_id(where.user_id)
    if (where.user_id) {
        return data.id
    } else {
        return data.user_id
    }
}

async function getGroup_id(where) {
    if (where.group_id) {
        if (!isNaN(Number(where.group_id))) {
            return Number(where.group_id)
        }
        where.group_id = String(where.group_id)
    }
    let data = await findGroup_id(where)
    if (!data) data = await saveGroup_id(where.group_id)
    if (where.group_id) {
        return data.id
    } else {
        return data.group_id
    }
}

export {
    getMsg,
    setMsg,
    getLatestMsg,
    getGuildLatestMsgId,
    setGuildLatestMsgId,
    getQQBotLateseReply,
    setQQBotLateseReply,
    getUser_id,
    getGroup_id
}