import { Config } from "../components/index.js"

let latestMsg = null

let guildLatestMesId = null

async function getMsgMap(key) {
    let msg = await redis.get(`Yz:ws-plugin:msg:${key}`)
    if (!msg) {
        return null
    }
    return JSON.parse(msg)
}

async function setMsgMap(key, value) {
    const EX = Config.msgStoreTime
    if (EX > 0) await redis.set(`Yz:ws-plugin:msg:${key}`, JSON.stringify(value), { EX })
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