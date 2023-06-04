import plugin from '../../../lib/plugins/plugin.js'
import _ from 'lodash'
import { socketList, Config } from '../components/index.js'
import { makeOneBotReportMsg, makeGSUidReportMsg } from '../model/index.js'

export class onebot extends plugin {
  constructor() {
    super({
      name: '[ws-plugin] 接收消息',
      dsc: '[ws-plugin] 接收消息',
      event: 'message',
      priority: Config.priority,
      rule: [
        {
          reg: '',
          fnc: 'onebot',
          log: false
        },
      ]
    })

  }

  async onebot() {
    if (socketList.length == 0) {
      return false
    }
    if (this.e.detail_type === 'guild') {
      return false
    }
    socketList.forEach(async socket => {
      if (Number(socket.type) != 3) {
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