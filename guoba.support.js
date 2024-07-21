import lodash from 'lodash'
import { Config } from './components/index.js'

// 支持锅巴
export function supportGuoba() {
  let groupList = Array.from(Bot.gl.values())
  groupList = groupList.map(item => item = { label: `${item.group_name}-${item.group_id}`, value: item.group_id })
  return {
    // 插件信息，将会显示在前端页面
    // 如果你的插件没有在插件库里，那么需要填上补充信息
    // 如果存在的话，那么填不填就无所谓了，填了就以你的信息为准
    pluginInfo: {
      name: 'ws-plugin',
      title: 'ws-plugin',
      author: '@小叶',
      authorLink: 'https://gitee.com/xiaoye12123',
      link: 'https://gitee.com/xiaoye12123/ws-plugin',
      isV3: true,
      isV2: false,
      description: 'Yunzai-Bot 的扩展插件 ws-plugin 提供ontbot协议适配,通过ws连接onebot实现的bot',
      // 显示图标，此为个性化配置
      // 图标可在 https://icon-sets.iconify.design 这里进行搜索
      icon: 'bx:atom',
      // 图标颜色，例：#FF0000 或 rgb(255, 0, 0)
      iconColor: 'rgb(241,212,152)',
      // 如果想要显示成图片，也可以填写图标路径（绝对路径）
      // iconPath: path.join(_paths.pluginRoot, 'resources/images/icon.png'),
    },
    // 配置项信息
    configInfo: {
      // 配置项 schemas
      schemas: [
        {
          component: 'Divider',
          label: 'WS连接设置'
        },
        {
          field: 'ws.servers',
          label: '连接服务列表',
          component: 'GSubForm',
          componentProps: {
            multiple: true,
            schemas: [
              {
                field: 'name',
                label: '连接名字',
                bottomHelpMessage: '请保证每个名字都不相同,否则会出问题',
                component: 'Input',
                required: true
              },
              {
                field: 'address',
                label: '连接地址',
                component: 'Input',
                required: true
              },
              {
                field: 'type',
                label: '连接类型',
                component: 'RadioGroup',
                required: true,
                componentProps: {
                    options: [
                        { label: '反向ws', value: 1 },
                        { label: '正向ws', value: 2 },
                        { label: 'gscore', value: 3 },
                        { label: 'red', value: 4 },
                        { label: '正向http', value: 5 },
                        { label: '反向http', value: 6 },
                         ],
                  },
              },
              {
                field: 'reconnectInterval',
                label: '重连间隔',
                component: 'InputNumber',
                required: true,
                componentProps: {
                    addonAfter: '秒'
                }
              },
              {
                field: 'maxReconnectAttempts',
                label: '最大连接次数',
                bottomHelpMessage: '0 为无限制',
                component: 'InputNumber',
                required: true,
                componentProps: {
                    addonAfter: '次'
                }
              }
            ]
          }
        },
        {
          component: 'Divider',
          label: '通知设置'
        },
        {
          field: 'msg.noMsgStart',
          label: '上报设置1',
          bottomHelpMessage: '以数组内开头的消息不上报',
          component: 'GTags',
          componentProps: {
            allowAdd: true,
            allowDel: true,
          },
        },
        {
          field: 'msg.noMsgInclude',
          label: '上报设置2',
          bottomHelpMessage: '包含了数组内的消息不上报',
          component: 'GTags',
          componentProps: {
            allowAdd: true,
            allowDel: true,
          },
        },
        {
          field: 'msg.noGroup',
          label: '黑名单群聊',
          bottomHelpMessage: '数组内的群消息不上报',
          component: 'GSelectGroup',
          componentProps: {
            allowAdd: true,
            allowDel: true,
            mode: 'multiple',
            options: groupList
          }
        },
        {
          field: 'msg.yesGroup',
          label: '白名单群聊',
          bottomHelpMessage: '只上报数组内的群消息',
          component: 'GSelectGroup',
          componentProps: {
            allowAdd: true,
            allowDel: true,
            mode: 'multiple',
            options: groupList
          }
        },
        {
          field: 'msg.disconnectToMaster',
          label: '断开连接',
          bottomHelpMessage: '断开连接时否通知主人',
          component: 'Switch',
        },
        {
          field: 'msg.reconnectToMaster',
          label: '重新连接',
          bottomHelpMessage: '重新连接成功时是否通知主人',
          component: 'Switch',
        },
        {
          field: 'msg.firstconnectToMaster',
          label: '首次连接',
          bottomHelpMessage: '首次连接时是否通知主人成功还是失败',
          component: 'Switch',
        },
        {
          field: 'msg.msgStoreTime',
          label: '消息存储时间',
          bottomHelpMessage: '消息存储时间,用于撤回和回复消息',
          component: 'InputNumber',
          required: true,
          componentProps: {
            min: 0,
            placeholder: '请输入时间',
            addonAfter: '秒'
          },
        },
        {
          field: 'msg.redSendForwardMsgType',
          label: 'red伪造转发',
          bottomHelpMessage: '可选: 1:伪造转发 2:陆续发送 3:合并发送 4:图片方式',
          component: 'RadioGroup',
          componentProps: {
            options: [
              { label: '伪造转发', value: 1 },
              { label: '分开发送', value: 2 },
              { label: '合并发送', value: 3 },
              { label: '图片方式', value: 4 },
            ],
          },
        },
        {
          field: 'msg.renderScale',
          label: '图片渲染精度',
          bottomHelpMessage: '设置高精度会提高图片的精细度，但因图片较大可能会影响渲染与发送速度',
          component: 'InputNumber',
          required: true,
          componentProps: {
            min: 50,
            max: 200,
            placeholder: '请输入图片渲染精度',
          },
        },
        {
          component: 'Divider',
          label: '上报设置'
        },
        {
          field: 'notice.groupAdmin',
          label: '管理变动',
          bottomHelpMessage: '群管理员变动是否上报',
          component: 'Switch',
        },
        {
          field: 'notice.groupDecrease',
          label: '群员减少',
          bottomHelpMessage: '群成员减少是否上报',
          component: 'Switch',
        },
        {
          field: 'notice.groupIncrease',
          label: '群员增加',
          bottomHelpMessage: '群成员增加是否上报',
          component: 'Switch',
        },
        {
          field: 'notice.groupBan',
          label: '群内禁言',
          bottomHelpMessage: '群禁言是否上报',
          component: 'Switch',
        },
        {
          field: 'notice.friendIncrease',
          label: '好友添加',
          bottomHelpMessage: '好友添加是否上报(添加成功之后)',
          component: 'Switch',
        },
        {
          field: 'notice.groupRecall',
          label: '群内撤回',
          bottomHelpMessage: '群消息撤回是否上报',
          component: 'Switch',
        },
        {
          field: 'notice.friendRecall',
          label: '好友撤回',
          bottomHelpMessage: '好友消息撤回是否上报',
          component: 'Switch',
        },
        {
          field: 'notice.groupPoke',
          label: '群戳一戳',
          bottomHelpMessage: '群内戳一戳是否上报',
          component: 'Switch',
        },
        {
          component: 'Divider',
          label: '请求设置'
        },
        {
          field: 'request.friendAdd',
          label: '好友申请',
          bottomHelpMessage: '好友申请是否上报',
          component: 'Switch',
        },
        {
          field: 'request.groupInvite',
          label: '群聊邀请',
          bottomHelpMessage: '群聊邀请是否上报 (邀请机器人入群)',
          component: 'Switch',
        },
        {
          field: 'request.groupAdd',
          label: '群聊申请',
          bottomHelpMessage: '群聊申请是否上报 (申请加入群聊)',
          component: 'Switch',
        },
        {
          component: 'Divider',
          label: '连接设置'
        },
        {
          field: 'ws.heartbeatInterval',
          label: '心跳频率',
          bottomHelpMessage: '心跳频率',
          component: 'InputNumber',
          required: true,
          componentProps: {
            min: 0,
            placeholder: '请输入心跳频率时间',
            addonAfter: '秒'
          },
        },
        {
          field: 'ws.messagePostFormat',
          label: '上报类型',
          component: 'RadioGroup',
          componentProps: {
            options: [
              { label: 'string', value: 1 },
              { label: 'array', value: 2 },
            ],
          },
        },
      ],
      // 获取配置数据方法（用于前端填充显示数据）
      getConfigData() {
        return {
          ws: Config.getDefOrConfig('ws-config'),
          msg: Config.getDefOrConfig('msg-config'),
          notice: Config.getDefOrConfig('notice-config'),
          request: Config.getDefOrConfig('request-config')
        }
      },
      // 设置配置的方法（前端点确定后调用的方法）
      setConfigData(data, { Result }) {
        let config = Config.getCfg()
        for (const key in data) {
          let split = key.split('.')
          if (lodash.isEqual(config[split[1]], data[key])) continue
          Config.modify(split[0] + '-config', split[1], data[key])
        }
        return Result.ok({}, '保存成功~')
      },
    },
  }
}
