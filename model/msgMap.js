import { Config } from "../components/index.js"
import { setMessage_id, getMessage_id, existSQL } from './db/index.js'

let latestMsg = null

let guildLatestMesId = null

async function getMsgMap(where, other) {
    if (existSQL) {
        const msg = await getMessage_id(where, other)
        return msg
    } else {
        let key = value.onebot_id || value.message_id
        let msg = await redis.get(`Yz:ws-plugin:msg:${key}`)
        if (!msg) {
            return null
        }
        return JSON.parse(msg)
    }
}

async function setMsgMap(value) {
    if (existSQL) {
        await setMessage_id(value)
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

function getGuildLatestMsgId() {
    return guildLatestMesId
}

function setGuildLatestMsgId(message_id) {
    guildLatestMesId = message_id
}

export {
    getMsgMap,
    setMsgMap,
    getLatestMsg,
    getGuildLatestMsgId,
    setGuildLatestMsgId
}