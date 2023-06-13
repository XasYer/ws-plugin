import { socketList } from '../../components/index.js'
import { makeOneBotReportMsg, makeGSUidReportMsg } from '../../model/index.js'
import _ from 'lodash'

Bot.on('message', async e => {
    //如果没有已连接的Websocket
    if (socketList.length == 0) {
        return false
    }
    //深拷贝e
    let msg = _.cloneDeep(e);
    //增加isGroup
    if (msg.message_type == 'group') {
        msg.isGroup = true
    } else if (msg.message_type == 'private') {
        msg.isGroup = false
    } else {
        return false
    }
    socketList.forEach(async socket => {
        if (Number(socket.type) != 3) {
            await SendOneBotMsg(socket, msg)
        } else {
            await SendGSUidMsg(socket, msg)
        }
    })
})

async function SendOneBotMsg(socket, e) {
    let Message = await makeOneBotReportMsg(e)
    if (!Message) {
        return
    }
    socket.send(Message)
}

async function SendGSUidMsg(socket, e) {
    let bytes = await makeGSUidReportMsg(e)
    if (!bytes) {
        return
    }
    socket.send(bytes)
}