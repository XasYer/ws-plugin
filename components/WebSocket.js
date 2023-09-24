import Client from "./Client.js";
import { Config, Version } from './index.js'

let sendSocketList = []
let allSocketList = []

function createWebSocket(data) {
    if (data.address == 'ws_address') return
    if (data.close) return
    const client = new Client(data)
    sendSocketList = sendSocketList.filter(i => i.name != data.name)
    allSocketList = allSocketList.filter(i => i.name != data.name)
    switch (Number(data.type)) {
        case 1:
            if (!checkVersion(data)) return
            client.createWs()
            sendSocketList.push(client)
            break;
        case 2:
            if (!checkVersion(data)) return
            client.createServer()
            sendSocketList.push(client)
            break
        case 3:
            client.createGSUidWs()
            sendSocketList.push(client)
            break
        case 4:
            if (!Version.isTrss) return
            client.createQQNT()
            break
        case 5:
            if (!checkVersion(data)) return
            client.createHttp()
            break
        case 6:
            if (!checkVersion(data)) return
            client.createHttpPost()
            sendSocketList.push(client)
            break
        default:
            return;
    }
    allSocketList.push(client)
}

function checkVersion(data) {
    if (Version.isTrss && !data.uin) {
        logger.warn(`${data.name} 缺少配置项uin 请删除连接后重新#ws添加连接`)
        return false
    }
    return true
}

function modifyWebSocket(target) {
    // if (Version.isTrss) return
    switch (target.type) {
        case 'add':
        case 'open':
            createWebSocket(target.data)
            break;
        case 'del':
        case 'close':
            for (const i of allSocketList) {
                if (i.name == target.data.name) {
                    i.close()
                    break
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


function initWebSocket() {
    // if (Version.isTrss) return
    for (const i of Config.servers) {
        createWebSocket(i)
    }
}


export {
    initWebSocket,
    clearWebSocket,
    modifyWebSocket,
    allSocketList,
    sendSocketList
}

