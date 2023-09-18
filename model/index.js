import { lifecycle, heartbeat } from './meta.js'
import { makeOneBotReportMsg, makeGSUidReportMsg, makeGSUidSendMsg } from './makeMsg.js'
import { getApiData } from './api.js'
import { setGuildLatestMsgId, getGuildLatestMsgId, setMsgMap } from './msgMap.js'
import { QQNTBot, getToken, toQQNTMsg } from './qqnt/index.js'

export {
    lifecycle,
    heartbeat,
    makeOneBotReportMsg,
    makeGSUidReportMsg,
    getApiData,
    makeGSUidSendMsg,
    setGuildLatestMsgId,
    getGuildLatestMsgId,
    setMsgMap,
    QQNTBot,
    getToken,
    toQQNTMsg
}