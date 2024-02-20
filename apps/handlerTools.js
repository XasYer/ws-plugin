import plugin from '../../../lib/plugins/plugin.js'
import { toImg } from '../model/index.js'
export class HandlerTools extends plugin {
  constructor () {
    super({
      name: 'ws-plugin-tool',
      priority: 1,
      namespace: 'ws-plugin-tool',
      rule: [{ reg: '#ws转图片.*', fnc: 'wsToImg' }],
      handler: [{
        key: 'ws.tool.toImg',
        fn: 'wsToolToImg'
      }]
    })
  }

  /**
   * ws文字转图片
   * @param e
   * @param data
   * @param cfg
   * @returns {Promise<*|*[]>}
   */
  async wsToolToImg (e, data, cfg = {}) {
    if (!data) return false
    if (!Object.keys(cfg).length) {
      cfg = { retType: e?.retType || 'default' }
    }
    return await toImg(data, e, cfg)
  }

  /**
   * ws文字/图片转图片
   * @param e
   * @returns {Promise<*|boolean>}
   */
  async wsToImg (e) {
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
      this.e.retType = 'base64'
      const ret = await handler.call('ws.tool.toImg', this.e, message)
      return this.e.reply(ret, true, { at: true })
    }
  }
}
