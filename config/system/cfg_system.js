export const cfgSchema = {
  ws: {
    title: 'ws连接设置,改动此设置会将所有已连接强制断开重连',
    cfg: {
      heartbeatInterval: {
        title: '心跳频率',
        key: '心跳',
        type: 'num',
        def: 5,
        desc: '单位:秒,0为关闭心跳',
        fileName: 'ws-config'
      },
      messagePostFormat: {
        title: '上报数据类型',
        key: '上报',
        type: 'num',
        def: 2,
        input: (n) => Math.min(2, Math.max(n * 1 || 0, 1)),
        desc: '上报数据类型: 1:string 2:array',
        fileName: 'ws-config'
      }
    }
  },
  msg: {
    title: '发送消息相关设置',
    cfg: {
      disconnectToMaster: {
        title: '断连通知',
        key: '断连通知',
        def: false,
        desc: '断开连接时是否通知主人',
        fileName: 'msg-config'
      },
      reconnectToMaster: {
        title: '重连通知',
        key: '重连通知',
        def: false,
        desc: '重新连接成功时是否通知主人',
        fileName: 'msg-config'
      },
      firstconnectToMaster: {
        title: '首连通知',
        key: '首连通知',
        def: false,
        desc: '首次连接时是否通知主人成功还是失败',
        fileName: 'msg-config'
      }
    }
  }
}
