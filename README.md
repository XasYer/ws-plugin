# ws-plugin

## 介绍
Yunzai-Bot 的扩展插件 ws-plugin 提供ontbot协议适配,通过ws连接onebot实现的bot

### 什么是onebot

OneBot 是一个聊天机器人应用接口标准，旨在统一不同聊天平台上的机器人应用开发接口，使开发者只需编写一次业务逻辑代码即可应用到多种机器人平台。

### 可以用ws-plugin实现什么功能

可以在Yunzai-Bot的基础上连接多个使用onebot协议的机器人,比如[NoneBot2](https://github.com/nonebot/nonebot2), [zhenxun_bot](https://github.com/HibiKier/zhenxun_bot), [ZeroBot-Plugin](https://github.com/FloatTech/ZeroBot-Plugin)等

## 安装与更新

### 使用Git安装（推荐）

请将 ws-plugin 放置在 Yunzai-Bot 的 plugins 目录下，重启 Yunzai-Bot 后即可使用。

请使用 git 进行安装，以方便后续升级。在 Yunzai-Bot 根目录夹打开终端，运行下述指令之一

```
git clone --depth=1 https://gitee.com/xiaoye12123/ws-plugin.git ./plugins/ws-plugin/
pnpm i

```

进行安装。安装完毕后，管理员只需发送 `#ws更新` 即可自动更新 ws-plugin。

### 手工下载安装（不推荐）

手工下载安装包，解压后将`ws-plugin-master`更名为`ws-plugin`，然后放置在Yunzai的plugins目录内

虽然此方式能够使用，但无法使用`#ws更新`进行更新，不利于后续升级，故不推荐使用

## 使用说明

帮助列表更新中

当前指令: 只支持主人私聊Bot
1.  #ws添加连接
2.  #ws删除连接
3.  #ws设置

以下指令全部人可用
1.  #ws版本

添加和删除之后会自动进行断开所有已连接的ws进行重连

## 支持的通信方式(连接类型)

1. 反向 WebSocket
2. 正向 WebSocket  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;!目前可能会有bug
3. [gsuid_core](https://github.com/Genshin-bots/gsuid_core)

## 反馈或建议

QQ群 [698673296](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=0xSHDCUDrVbiOKe7ksEi5xpxdmJj8VRT&authKey=gnMoAHGtaQcqlGg50M%2B6QvIvKsyzMrPymK0FjIxCe7mdzUM8rSIi2jvxWczaZEU5&noverify=0&group_code=698673296)

## onebot实现

<details>
<summary>已实现 CQ 码</summary>

| CQ 码        | 功能                        |
| ------------ | --------------------------- |
| [CQ:image]   | [图片]                      |
| [CQ:at]      | [@某人]                     |
| [CQ:poke]    | [戳一戳]                    |
| [CQ:reply]   | [回复]                      |
| [CQ:node]    | [合并转发自定义节点]         |

[图片]: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md#%E5%9B%BE%E7%89%87
[@某人]: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md#%E6%9F%90%E4%BA%BA
[戳一戳]: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md#%E6%88%B3%E4%B8%80%E6%88%B3
[回复]: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md#%E5%9B%9E%E5%A4%8D
[合并转发自定义节点]: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md#%E5%90%88%E5%B9%B6%E8%BD%AC%E5%8F%91%E8%87%AA%E5%AE%9A%E4%B9%89%E8%8A%82%E7%82%B9

</details>

<details>
<summary>已实现 API</summary>

| API                   | 功能                        |
| --------------------- | --------------------------- |
| send_private_msg      | [发送私聊消息]               |
| send_group_msg        | [发送群聊消息]               |
| send_msg              | [发送消息]                   |
| delete_msg            | [撤回消息]                   |
| get_msg               | [获取消息]                   |
| set_group_ban         | [群组单人禁言]               |
| get_login_info        | [获取登录号信息]             |
| get_stranger_info     | [获取陌生人信息]             |
| get_friend_list       | [获取好友列表]               |
| get_group_info        | [获取群信息]                 |
| get_group_list        | [获取群列表]                 |
| get_group_member_info | [获取群成员信息]              |
| get_group_member_list | [获取群成员列表]              |

[发送私聊消息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#send_private_msg-%E5%8F%91%E9%80%81%E7%A7%81%E8%81%8A%E6%B6%88%E6%81%AF
[发送群聊消息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#send_group_msg-%E5%8F%91%E9%80%81%E7%BE%A4%E6%B6%88%E6%81%AF
[发送消息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#send_msg-%E5%8F%91%E9%80%81%E6%B6%88%E6%81%AF
[撤回消息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#delete_msg-%E6%92%A4%E5%9B%9E%E6%B6%88%E6%81%AF
[获取消息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_msg-%E8%8E%B7%E5%8F%96%E6%B6%88%E6%81%AF
[群组单人禁言]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_ban-%E7%BE%A4%E7%BB%84%E5%8D%95%E4%BA%BA%E7%A6%81%E8%A8%80
[获取登录号信息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_login_info-%E8%8E%B7%E5%8F%96%E7%99%BB%E5%BD%95%E5%8F%B7%E4%BF%A1%E6%81%AF
[获取陌生人信息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_stranger_info-%E8%8E%B7%E5%8F%96%E9%99%8C%E7%94%9F%E4%BA%BA%E4%BF%A1%E6%81%AF
[获取好友列表]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_friend_list-%E8%8E%B7%E5%8F%96%E5%A5%BD%E5%8F%8B%E5%88%97%E8%A1%A8
[获取群信息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_group_info-%E8%8E%B7%E5%8F%96%E7%BE%A4%E4%BF%A1%E6%81%AF
[获取群列表]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_group_list-%E8%8E%B7%E5%8F%96%E7%BE%A4%E5%88%97%E8%A1%A8
[获取群成员信息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_group_member_info-%E8%8E%B7%E5%8F%96%E7%BE%A4%E6%88%90%E5%91%98%E4%BF%A1%E6%81%AF
[获取群成员列表]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_group_member_list-%E8%8E%B7%E5%8F%96%E7%BE%A4%E6%88%90%E5%91%98%E5%88%97%E8%A1%A8

</details>

<details>
<summary>已实现 Event</summary>

| 事件类型  | Event            |
| -------- | ---------------- |
| 通知事件  | [群管理员变动]    |
| 通知事件  | [群成员减少]      |
| 通知事件  | [群成员增加]      |
| 通知事件  | [群禁言]          | 
| 通知事件  | [好友添加]        |
| 通知事件  | [群消息撤回]      |
| 通知事件  | [好友消息撤回]    |
| 通知事件  | [群内戳一戳]      |

[群管理员变动]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E7%BE%A4%E7%AE%A1%E7%90%86%E5%91%98%E5%8F%98%E5%8A%A8
[群成员减少]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E7%BE%A4%E6%88%90%E5%91%98%E5%87%8F%E5%B0%91
[群成员增加]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E7%BE%A4%E6%88%90%E5%91%98%E5%A2%9E%E5%8A%A0
[群禁言]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E7%BE%A4%E7%A6%81%E8%A8%80
[好友添加]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E5%A5%BD%E5%8F%8B%E6%B7%BB%E5%8A%A0
[群消息撤回]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E7%BE%A4%E6%B6%88%E6%81%AF%E6%92%A4%E5%9B%9E
[好友消息撤回]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E5%A5%BD%E5%8F%8B%E6%B6%88%E6%81%AF%E6%92%A4%E5%9B%9E
[群内戳一戳]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E7%BE%A4%E5%86%85%E6%88%B3%E4%B8%80%E6%88%B3

</details>

## TODO

1.  更详细的帮助和设置
2.  支持锅巴
3.  支持更多onebot api

## 鸣谢

* [miao-plugin](https://gitee.com/yoimiya-kokomi/miao-plugin) : 使用的ui代码及实现均来自miao-plugin
* [onebot](https://github.com/botuniverse/onebot) : 统一的聊天机器人应用接口标准
* [Miao-Yunzai](https://github.com/yoimiya-kokomi/Miao-Yunzai) : 喵版Yunzai [Gitee](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)
  / [Github](https://github.com/yoimiya-kokomi/Miao-Yunzai)
* [Yunzai-V3](https://github.com/yoimiya-kokomi/Yunzai-Bot) ：Yunzai V3 - 喵喵维护版（使用 icqq）
* [Yunzai-V3](https://gitee.com/Le-niao/Yunzai-Bot) ：Yunzai V3 - 乐神原版（使用 oicq）


## 免责声明

1. 功能仅限内部交流与小范围使用，请勿将Yunzai-Bot及ws-plugin用于以盈利为目的的场景
2. 图片与其他素材均来自于网络，仅供交流学习使用，如有侵权请联系，会立即删除

## 其他

如果觉得此插件对你有帮助的话,可以点一个star,你的支持就是不断更新的动力~

## 访问量

[![访问量](https://profile-counter.glitch.me/xiaoye12123-ws-plugin/count.svg)](https://gitee.com/xiaoye12123/ws-plugin)