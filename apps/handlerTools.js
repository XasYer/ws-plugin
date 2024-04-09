import plugin from '../../../lib/plugins/plugin.js'
import { htmlCache, toImg } from '../model/index.js'
import { findUser_id } from '../model/db/index.js'

const getMsgReg = new RegExp('^#ws查看\s*([0-9]+)$')
export class HandlerTools extends plugin {
  constructor() {
    super({
      name: '[ws-plugin] tool',
      dsc: '[ws-plugin] tool',
      priority: 1,
      namespace: 'ws-plugin-tool',
      rule: [
        { reg: '#ws转图片.*', fnc: 'wsToImg' },
        { reg: getMsgReg, fnc: 'getMsg' }
      ],
      handler: [
        { key: 'ws.tool.toImg', fn: 'wsToolToImg' },
        { key: 'ws.tool.findUserId', fn: 'wsFindUserId' }
      ]
    })
  }

  /**
   * ws文字转图片
   * @param e
   * @param data
   * @returns {Promise<*|*[]>}
   */
  async wsToolToImg(e, data) {
    if (!data) return false
    const cfg = data.cfg || { retType: e?.retType || 'default' }
    data = data.wsdata || data.wsData || data
    return await toImg(data, e, cfg)
  }

  async wsFindUserId(where, order) {
    return await findUser_id(where, order)
  }

  /**
   * ws文字/图片转图片
   * @param e
   * @returns {Promise<*|boolean>}
   */
  async wsToImg(e) {
    if (!e.user_id) {
      return false
    }
    let message = this.e.message || []
    if (!message || message.length === 0) {
      return false
    }
    message = message.filter(item => { return item?.type === 'text' || item?.type === 'image' || false }).map(item => { return item?.text ? item?.text?.replace(/#ws转图片/, '') : item })
    if (message.length === 0) {
      this.e.reply('没有要转换的文字哦~')
      return false
    }
    let handler = this.e.runtime?.handler || {}
    // 如果有注册的ws.tool.toImg，调用
    if (handler.has('ws.tool.toImg')) {
      const data = { wsData: message, cfg: { retType: 'base64', saveId: new Date().getTime() } }
      const ret = await handler.call('ws.tool.toImg', this.e, data)
      return this.e.reply(ret, true, { at: true })
    }
  }

  /**
   * 查看消息
   * @param e
   * @returns {Promise<boolean>}
   */
  async getMsg(e) {
    const id = getMsgReg.exec(e.msg)
    const msg = htmlCache[id[1]]
    if (msg) {
      e.reply(msg)
    }
    return true
  }
}
