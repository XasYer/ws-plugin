import _ from 'lodash'
import { Config } from '../components/index.js'

function msgToOneBotMsg(msg, other = {}) {
    let reportMsg = []
    //前缀处理
    if (other.startsWith) {
        if (msg[0].type == 'text') {
            if (Array.isArray(Config.noMsgStart) && Config.noMsgStart.length > 0) {
                if (Config.noMsgStart.some(item => msg[0].text.startsWith(item))) {
                    return false
                }
            }
            if (other.isGroup) {
                let groupCfg = cfg.getGroup(e.group_id)
                let alias = groupCfg.botAlias
                if (!Array.isArray(alias)) {
                    alias = [alias]
                }
                for (let name of alias) {
                    if (msg[0].text.startsWith(name)) {
                        msg[0].text = _.trimStart(msg[0].text, name).trim()
                        break
                    }
                }
            }
        }
    }
    if (other.source) {
        reportMsg.push({
            "type": "reply",
            "data": {
                "id": other.source.rand
            }
        })
    }
    for (let i = 0; i < msg.length; i++) {
        switch (msg[i].type) {
            case 'at':
                reportMsg.push({
                    "type": "at",
                    "data": {
                        "qq": msg[i].qq
                    }
                })
                break
            case 'text':
                if (Array.isArray(Config.noMsgStart) && Config.noMsgInclude.length > 0) {
                    if (Config.noMsgInclude.some(item => msg[i].text.includes(item))) {
                        return false
                    }
                }
                reportMsg.push({
                    "type": "text",
                    "data": {
                        "text": msg[i].text
                    }
                })
                break
            case 'image':
                reportMsg.push({
                    "type": "image",
                    "data": {
                        file: msg[i].file,
                        subType: 0,
                        url: msg[i].url
                    }
                })
                break
            case 'json':
                reportMsg.push({
                    "type": 'json',
                    "data": {
                        "data": msg[i].data
                    }
                })
                break
            case 'face':
                reportMsg.push({
                    'type': 'face',
                    'data': {
                        'id': msg[i].id
                    }
                })
                break
            case 'record':
                reportMsg.push({
                    'type': 'record',
                    'data': {
                        'file': msg[i].file
                    }
                })
                break
            default:
                break
        }
    }
    return reportMsg
}

export {
    msgToOneBotMsg
}