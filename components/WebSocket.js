import Client from "./Client.js";
import { Config, Version } from './index.js'

let socketList = []

function createWebSocket(data) {
    if (data.address == 'ws_address') return
    if (data.close) return
    const client = new Client(data)
    switch (Number(data.type)) {
        case 1:
            // if (Version.isTrss) return
            client.createWs()
            break;
        case 2:
            // if (Version.isTrss) return
            client.createServer()
            break
        case 3:
            // if (Version.isTrss) return
            client.createGSUidWs()
            break
        case 4:
            if (!Version.isTrss) return
            client.createQQNT()
            return
        case 5:
            client.createWs()
            break
        default:
            return;
    }
    socketList = socketList.filter(i => i.name != data.name)
    socketList.push(client)
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
            for (const i of socketList) {
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
    for (const i of socketList) {
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
    socketList,
}

