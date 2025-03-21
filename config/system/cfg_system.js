export const cfgSchema = {
  ws: {
    title: 'ws连接设置,重启生效',
    cfg: {
      heartbeatInterval: {
        title: '心跳频率',
        key: '心跳',
        type: 'num',
        def: 5,
        input: (n) => {
          if (n >= 0) {
            return n * 1
          } else {
            return 5
          }
        },
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
      },
      wsPort: {
        title: 'ws-plugin用到的端口',
        key: '端口',
        type: 'num',
        def: 54545,
        input: (n) => {
          if (n > 0 && n <= 65535) {
            return n * 1
          } else {
            return 54545
          }
        },
        desc: 'ws-plugin用到的端口,1-65535,仅限喵崽',
      },
      ignoreOnlyReplyAt: {
        title: '忽略仅艾特',
        key: '忽略艾特',
        def: false,
        desc: '是否忽略云崽配置文件的仅艾特和前缀,即不需要艾特或前缀即可上报消息',
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
      },
      howToMaster: {
        title: '通知哪个主人',
        key: '主人',
        type: 'num',
        input: (n) => {
          if (n >= 0) {
            return n * 1
          } else {
            return 1
          }
        },
        def: 1,
        desc: `通知主人列表的第几个主人,为0时通知全部主人`,
        fileName: 'msg-config'
      },
      muteStop: {
        title: '禁言拦截',
        key: '禁言拦截',
        def: false,
        desc: '被禁言或者全体禁言时是否拦截消息不上报',
        fileName: 'msg-config'
      },
      tempMsgReport: {
        title: '拦截临时消息',
        key: '临时拦截',
        def: false,
        desc: '是否拦截临时消息上报',
        fileName: 'msg-config'
      },
      toImgID: {
        title: '转图片ID',
        key: '图片id',
        type: 'num',
        def: 0,
        desc: '文字转图片是否展示ID 0:不展示 1:仅ID 2:提示+ID',
        input: (n) => Math.min(2, Math.max(n * 1 || 0, 1)),
        fileName: 'msg-config'
      },
      redSendForwardMsgType: {
        title: 'red转发方式',
        key: 'red转发',
        type: 'num',
        def: 1,
        desc: 'red 发送伪造转发消息方式 1:伪造转发 2:分开发送 3:合并发送 4:图片方式',
        input: (n) => Math.min(4, Math.max(n * 1 || 0, 1)),
        fileName: 'msg-config'
      },
      msgStoreTime: {
        title: '消息存储时间',
        key: '存储',
        type: 'num',
        input: (n) => {
          if (n >= 0) {
            return n * 1
          } else {
            return 600
          }
        },
        def: 600,
        desc: '用于撤回和回复消息,如果超过时间去获取就会获取不到,单位秒,0不存储',
        fileName: 'msg-config'
      },
      renderScale: {
        title: '渲染精度',
        key: '渲染',
        type: 'num',
        def: 100,
        input: (n) => Math.min(200, Math.max(50, (n * 1 || 100))),
        desc: '可选值50~200，建议100。设置高精度会提高图片的精细度，但因图片较大可能会影响渲染与发送速度',
        fileName: 'msg-config'
      },
      taskQueue: {
        title: '数据库同步锁',
        key: '同步',
        type: 'num',
        input: (n) => {
          if (n >= 0) {
            return n * 1
          } else {
            return 1
          }
        },
        def: 1,
        desc: '数据库同步锁,设置同时可执行的数据库操作最大次数,改动此项需要重启,0为关闭同步锁',
        fileName: 'msg-config'
      }
    }
  },
  notice: {
    title: '通知相关设置',
    cfg: {
      groupAdmin: {
        title: '管理员变动',
        key: '管理',
        def: false,
        desc: '群管理员变动是否上报',
        fileName: 'notice-config'
      },
      groupDecrease: {
        title: '群成员减少',
        key: '群员减少',
        def: false,
        desc: '群成员减少是否上报',
        fileName: 'notice-config'
      },
      groupIncrease: {
        title: '群成员增加',
        key: '群员增加',
        def: false,
        desc: '群成员增加是否上报',
        fileName: 'notice-config'
      },
      groupBan: {
        title: '群禁言',
        key: '禁言',
        def: false,
        desc: '群禁言是否上报',
        fileName: 'notice-config'
      },
      friendIncrease: {
        title: '好友添加',
        key: '好友添加',
        def: false,
        desc: '好友添加是否上报',
        fileName: 'notice-config'
      },
      groupRecall: {
        title: '群消息撤回',
        key: '群撤回',
        def: false,
        desc: '群消息撤回是否上报',
        fileName: 'notice-config'
      },
      friendRecall: {
        title: '好友消息撤回',
        key: '好友撤回',
        def: false,
        desc: '好友消息撤回是否上报',
        fileName: 'notice-config'
      },
      groupPoke: {
        title: '群内戳一戳',
        key: '戳一戳',
        def: false,
        desc: '群内戳一戳是否上报',
        fileName: 'notice-config'
      },
    }
  },
  request: {
    title: '请求相关设置',
    cfg: {
      friendAdd: {
        title: '好友申请',
        key: '好友申请',
        def: false,
        desc: '好友申请是否上报',
        fileName: 'request-config'
      },
      groupInvite: {
        title: '群聊邀请',
        key: '群邀请',
        def: false,
        desc: '群聊邀请是否上报 (邀请机器人入群)',
        fileName: 'request-config'
      },
      groupAdd: {
        title: '群聊申请',
        key: '群申请',
        def: false,
        desc: '群聊申请是否上报 (申请加入群聊)',
        fileName: 'request-config'
      },
    }
  },
  setAll: {
    title: '一键操作',
    cfg: {
      setAll: {
        title: '全部设置',
        key: '全部',
        def: false,
        desc: '一键 开启/关闭 全部设置项'
      }
    }
  }
}
