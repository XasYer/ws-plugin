import plugin from '../../../lib/plugins/plugin.js'
import { toImg } from '../model/index.js'
export class HandlerTools extends plugin {
  constructor () {
    super({
      name: 'ws-plugin-tool',
      priority: 1,
      namespace: 'ws-plugin-tool',
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
   * @returns {Promise<*|*[]>}
   */
  async wsToolToImg (e, data) {
    if (!e.user_id || !data) {
      return false
    }
    return await toImg(data, e)
  }

  // 参考
  // async wsToImg (e) {
  //   if (!e.user_id) {
  //     return false
  //   }
  //   let message = this.e.message || []
  //   if (!message || message.length === 0) {
  //     return false
  //   }
  //   message = message.filter(item => {
  //     return !item?.text?.includes('#ws转图片') || false
  //   })
  //
  //   let handler = this.e.runtime?.handler || {}
  //   // 如果有注册的ws.tool.toImg，调用
  //   if (handler.has('ws.tool.toImg')) {
  //     const ret = await handler.call('ws.tool.toImg', this.e, message)
  //     return ret
  //   }
  // }
}
