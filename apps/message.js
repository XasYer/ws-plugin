import plugin from '../../../lib/plugins/plugin.js'
import _ from 'lodash'
import { sockets } from '../components/index.js'
import { makeOneBotReportMsg, makeGSUidReportMsg } from '../model/index.js'

export class nonebot extends plugin {
  constructor() {
    super({
      name: '[ws-plugin] 接收消息',
      dsc: 'Yunzai-WebSocket',
      event: 'message',
      priority: 1,
      rule: [
        {
          reg: '',
          fnc: 'onebot',
          log: true
        },
      ]
    })

  }

  async onebot() {
    if (sockets.length == 0) {
      return false
    }
    sockets.forEach(async socket => {
      if (socket.type != 3) {
        await this.SendOneBotMsg(socket)
      } else {
        await this.SendGSUidMsg(socket)
      }
    })
    return false
  }

  async SendOneBotMsg(socket) {
    let Message = await makeOneBotReportMsg(this.e)
    if (!Message) {
      return false
    }
    socket.send(Message)
    return false
  }

  async SendGSUidMsg(socket) {
    let bytes = await makeGSUidReportMsg(this.e)
    if (!bytes) {
      return false
    }
    socket.send(bytes)
    return false
  }
}