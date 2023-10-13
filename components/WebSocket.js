import Client from "./Client.js";
import { Config, Version } from './index.js'
import { sleep } from '../model/index.js'
import { adapter } from '../model/red/index.js'
// import { redAdapter } from '../model/red/index.js'
// import { satoriAdapter } from '../model/satori/index.js'

let sendSocketList = []
let allSocketList = []

async function createWebSocket(data) {
    if (typeof data.close != 'undefined' && typeof data.closed == 'undefined') {
        data.closed = data.close
        delete data.close
    }
    const client = new Client(data)
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
        // case 4:
        //     if (!Version.isTrss) return
        //     client.createQQNT()
        //     break
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
        } else {
            for (let i = 0; i < 20; i++) {
                if (Version.protocol.some(i => i == Bot[data.uin]?.version?.name)) {
                    return true
                }
                logger.warn(`[ws-plugin] ${data.name} 未适配的协议或未连接对应协议,20秒后重新判断`)
                await sleep(1000)
            }
            logger.warn(`[ws-plugin] ${data.name} 未适配的协议或未连接对应协议`)
            return false
        }
    }
    return true
}

function modifyWebSocket(target) {
    // if (Version.isTrss) return
    switch (target.type) {
        case 'add':
        case 'open':
            if (target.data.type == 4) {
                const client = new Client(target.data)
                setAllSocketList(client)
                adapter.connect(client)
            } else {
                createWebSocket(target.data)
            }
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
    setAllSocketList,
    sendSocketList,
    createWebSocket
}

