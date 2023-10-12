export const helpCfg = {
  "themeSet": false,
  "title": "ws帮助",
  "subTitle": "Yunzai-Bot & ws-plugin",
  "colWidth": 265,
  "theme": "all",
  "themeExclude": [
    "default"
  ],
  "colCount": 3,
  "bgBlur": true
}
export const helpList = [
  {
    "group": "连接管理",
    "list": [
      {
        "icon": 80,
        "title": "#ws添加连接",
        "desc": "添加一个新的连接"
      },
      {
        "icon": 63,
        "title": "#ws删除连接",
        "desc": "删除一个已有的连接 "
      },
      {
        "icon": 66,
        "title": "#ws关闭连接",
        "desc": "不会删除已有连接,同时不进行连接"
      },
      {
        "icon": 65,
        "title": "#ws打开连接",
        "desc": "打开已关闭的连接"
      },
      {
        "icon": 79,
        "title": "#ws查看连接",
        "desc": "查看已有的所有连接名字和状态"
      },
      {
        "icon": 64,
        "title": "#ws重新连接",
        "desc": "断开连接并重新连接"
      }
    ]
  },
  {
    "group": "其他设置",
    "list": [
      {
        "icon": 81,
        "title": "#ws(增加/删除)(禁用/启用)群123456",
        "desc": "精确处理黑名单白名单,不带群号为当前群"
      },
      {
        "icon": 84,
        "title": "#ws(禁用/启用)群123456",
        "desc": "模糊匹配,比如禁用群则优先看白名单,如果有就删除,否则添加到黑名单"
      },
      {
        "icon": 85,
        "title": "#ws查看(禁用/启用)群",
        "desc": "查看当前(禁用/启用)的群聊列表"
      },
    ]
  },
  {
    "group": "其他说明",
    "list": [
      {
        "icon": 71,
        "title": "#ws连接说明",
        "desc": "查看添加连接时的说明"
      },
      {
        "icon": 94,
        "title": "#ws设置",
        "desc": "插件设置"
      }
    ]
  }
]