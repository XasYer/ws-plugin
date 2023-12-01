import Client from "./Client.js";
import { Config, Version } from './index.js'
import { sleep, getUser_id } from '../model/index.js'
import _ from "lodash";

let sendSocketList = []
let allSocketList = []

const adapterName = {
    'qg_': 'QQ频道Bot',
    'wx_': '微信Bot',
    'wxi': 'ComWeChat',
    'mv_': '米游社大别野Bot',
    'ko_': 'KOOKBot',
    'tg_': 'TelegramBot',
    'dc_': 'DiscordBot',
    'std': 'stdin'
}

async function createWebSocket(data) {
    if (typeof data.close != 'undefined' && typeof data.closed == 'undefined') {
        data.closed = data.close
        delete data.close
    }
    if (Array.isArray(data.uin)) {
        for (const uin of data.uin) {
            const str = String(uin)
            const i = _.cloneDeep(data)
            i.name += `(${str.slice(0, 4) + "..." + str.slice(-2)})`
            i.uin = uin
            await createWebSocket(i)
        }
        return
    }
    const client = new Client(data)
    if (typeof client.self_id === 'string') {
        client.self_id = await getUser_id({ user_id: client.self_id })
        client.adapter = adapterName[client.uin?.substring?.(0, 3)]
    } else {
        const self_id = String(client.self_id)
        if (/^(2854|3889)/.test(self_id) && self_id.length === 10) {
            client.adapter = 'QQBot'
        }
    }
    setAllSocketList(client)
    if (data.address == 'ws_address') return
    if (data.closed) return
    sendSocketList = sendSocketList.filter(i => i.name != data.name)
    switch (Number(data.type)) {
        case 1:
            if (!await checkVersion(data)) return
            client.createWs()
            sendSocketList.push(client)
            break;
        case 2:
            if (!await checkVersion(data)) return
            client.createServer()
            sendSocketList.push(client)
            break
        case 3:
            client.createGSUidWs()
            sendSocketList.push(client)
            break
        case 5:
            if (!await checkVersion(data)) return
            client.createHttp()
            break
        case 6:
            if (!await checkVersion(data)) return
            client.createHttpPost()
            sendSocketList.push(client)
            break
        default:
            return;
    }
}

function setAllSocketList(data) {
    allSocketList = allSocketList.filter(i => i.name != data.name)
    allSocketList.push(data)
}

async function checkVersion(data) {
    if (Version.isTrss) {
        if (!data.uin) {
            logger.warn(`[ws-plugin] ${data.name} 缺少配置项uin 请删除连接后重新#ws添加连接`)
            return false
        }
        // else {
        //     let log = false
        //     for (let i = 0; i < 20; i++) {
        //         if (Version.protocol.some(i => i == Bot[data.uin]?.version?.name)) {
        //             return true
        //         }
        //         if (!log) {
        //             logger.warn(`[ws-plugin] ${data.name} 暂未适配当前协议端或未连接对应协议端,20秒后重新判断,uin:${data.uin}`)
        //             log = true
        //         }
        //         await sleep(1000)
        //     }
        //     logger.warn(`[ws-plugin] ${data.name} 暂未适配当前协议端或未连接对应协议端,uin:${data.uin}`)
        //     return false
        // }
    } else if (Bot.uin == '88888') {
        if (!data.uin) {
            logger.warn(`[ws-plugin] ${data.name} 缺少配置项uin 请删除连接后重新#ws添加连接`)
            return false
        }
    }
    return true
}

async function modifyWebSocket(target) {
    // if (Version.isTrss) return
    switch (target.type) {
        case 'add':
        case 'open':
            await createWebSocket(target.data)
            break;
        case 'del':
        case 'close':
            for (const i of allSocketList) {
                const reg = new RegExp(`^${target.data.name}\(.{1,6}\)$`)
                if (i.name == target.data.name || reg.test(i.name)) {
                    i.close()
                }
            }
            break
        default:
            return;
    }
}

function clearWebSocket() {
    for (const i of allSocketList) {
        i.close()
    }
}


async function initWebSocket() {
    // if (Version.isTrss) return
    for (const i of Config.servers) {
        await createWebSocket(i)
    }
}


export {
    initWebSocket,
    clearWebSocket,
    modifyWebSocket,
    allSocketList,
    setAllSocketList,
    sendSocketList,
    createWebSocket
}

