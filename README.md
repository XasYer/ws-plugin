# ws-plugin

## 圣经

不使用，那开发的用处何在?不提交bug，那 issue的意义在哪里?解决问题是开发者应有的义务，有问题，那就要去解决完善，你的话我甚至觉得你没参与过开发，你如何论证我发视频是错误的?请问你有什么办法解决目前的协议问题?B站不引人注目，那请问QQ群是谁的地盘?我做视频为了引导开发者解决问题，请问你做了什么?如果你真想为bot做贡献，应该去提交is和pr，而不是在这里当鸵鸟以为不用就没人管了，我希望你作为一个开发者面对问题应该去解决它而不是把头埋进沙子假装看不见它,你不让我们用bot的居心何在?

## 介绍
Yunzai-Bot 的扩展插件 ws-plugin 提供ontbot协议适配,通过WebSocket连接onebot实现的bot

### 什么是onebot

OneBot 是一个聊天机器人应用接口标准，旨在统一不同聊天平台上的机器人应用开发接口，使开发者只需编写一次业务逻辑代码即可应用到多种机器人平台。

### 可以用ws-plugin实现什么功能

* 可以在Yunzai-Bot的基础上连接多个使用onebot协议的机器人,比如[NoneBot2](https://github.com/nonebot/nonebot2), [zhenxun_bot](https://github.com/HibiKier/zhenxun_bot), [ZeroBot-Plugin](https://github.com/FloatTech/ZeroBot-Plugin)等


### 支持的Yunzai-bot版本

#### [Miao-Yunzai](https://gitee.com/yoimiya-kokomi/Miao-Yunzai) && [Yunzai-Bot](https://gitee.com/yoimiya-kokomi/Yunzai-Bot) (即将停止对原版云崽的支持)

作为客户端:
  - onebot v11
    -  反向 WebSocket
    -  正向 WebSocket
    -  正向http
    -  反向http
  -  [gsuid_core](https://github.com/Genshin-bots/gsuid_core)

#### [TRSS-Yunzai](https://gitee.com/TimeRainStarSky/Yunzai)

作为客户端:
  - onebot v11 (已适配所有协议,如果对应协议的user_id和group_id为string则会转换成number,从1开始自增)
    -  反向 WebSocket
    -  正向 WebSocket
    -  正向http
    -  反向http
  -  [gsuid_core](https://github.com/Genshin-bots/gsuid_core)

## 安装与更新

### 使用Git安装（推荐）

请将 ws-plugin 放置在 Yunzai-Bot 的 plugins 目录下，重启 Yunzai-Bot 后即可使用。

请使用 git 进行安装，以方便后续升级。在 Yunzai-Bot 根目录夹打开终端，运行下述指令之一

```
#gitee
git clone --depth=1 https://gitee.com/xiaoye12123/ws-plugin.git ./plugins/ws-plugin/
pnpm install --filter=ws-plugin
```
```
#github
git clone --depth=1 https://github.com/XasYer/ws-plugin.git ./plugins/ws-plugin/
pnpm install --filter=ws-plugin
```

进行安装。安装完毕后，管理员只需发送 `#ws更新` 即可自动更新 ws-plugin。

## 使用说明

<details>
<summary>功能列表 | 只支持主人使用</summary>

| 指令          | 说明                         |
| ------------  | --------------------------- |
| #ws帮助       | 召唤出ws插件的帮助图          |
| #ws设置       | 进行ws插件相关设置            |
| #ws添加连接    | 添加一个新的连接             |
| #ws删除连接    | 删除一个已有的连接           |
| #ws关闭连接    | 暂时关闭某个连接             |
| #ws打开连接    | 打开关闭的连接               |
| #ws查看连接    | 查看当前已有连接和状态        |
| #ws重新连接    | 断开已有连接并重新连接        |
| #ws连接说明    | 查看添加连接参数的说明        |

</details>

## onebot实现

<details>
<summary>已实现 CQ 码</summary>

| CQ 码        | 功能                        |
| ------------ | --------------------------- |
| [CQ:face]    | [QQ表情]                    |
| [CQ:image]   | [图片]                      |
| [CQ:record]  | [语音]                      |
| [CQ:at]      | [@某人]                     |
| [CQ:poke]    | [戳一戳]                    |
| [CQ:music]   | [音乐分享]                  |
| [CQ:music]   | [音乐自定义分享]             |
| [CQ:reply]   | [回复]                      |
| [CQ:node]    | [合并转发自定义节点]         |
| [CQ:json]    | [JSON消息]                  |

[QQ表情]: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md#qq-%E8%A1%A8%E6%83%85
[图片]: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md#%E5%9B%BE%E7%89%87
[语音]: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md#%E8%AF%AD%E9%9F%B3
[@某人]: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md#%E6%9F%90%E4%BA%BA
[戳一戳]: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md#%E6%88%B3%E4%B8%80%E6%88%B3
[音乐分享]: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md#%E9%9F%B3%E4%B9%90%E5%88%86%E4%BA%AB-
[音乐自定义分享]: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md#%E9%9F%B3%E4%B9%90%E8%87%AA%E5%AE%9A%E4%B9%89%E5%88%86%E4%BA%AB-
[回复]: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md#%E5%9B%9E%E5%A4%8D
[合并转发自定义节点]: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md#%E5%90%88%E5%B9%B6%E8%BD%AC%E5%8F%91%E8%87%AA%E5%AE%9A%E4%B9%89%E8%8A%82%E7%82%B9
[JSON消息]: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md#json-%E6%B6%88%E6%81%AF

</details>

<details>
<summary>已实现 API</summary>

### 可能符合 OneBot 标准的 API

| API                   | 功能                        |
| --------------------- | --------------------------- |
| send_private_msg      | [发送私聊消息]               |
| send_group_msg        | [发送群聊消息]               |
| send_msg              | [发送消息]                   |
| delete_msg            | [撤回消息]                   |
| set_group_kick        | [群组踢人]                   |
| set_group_ban         | [群组单人禁言]               |
| set_group_anonymous_ban| [群组匿名禁言]              |
| set_group_whole_ban   | [群组全员禁言]               |
| set_group_admin       | [群组设置管理员]              |
| set_group_card        | [设置群名片（群备注）]         |
| set_group_name        | [设置群名]                   |
| set_group_leave       | [退出群组]                   |
| set_group_special_title| [设置群组专属头衔]           |
| set_friend_add_request | [处理加好友请求]            |
| set_group_add_request  | [处理加群请求/邀请]         |
| get_login_info        | [获取登录号信息]             |
| get_stranger_info     | [获取陌生人信息]             |
| get_friend_list       | [获取好友列表]               |
| get_group_info        | [获取群信息]                 |
| get_group_list        | [获取群列表]                 |
| get_group_member_info | [获取群成员信息]              |
| get_group_member_list | [获取群成员列表]              |
| get_version_info      | [获取版本信息]              |

[发送私聊消息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#send_private_msg-%E5%8F%91%E9%80%81%E7%A7%81%E8%81%8A%E6%B6%88%E6%81%AF
[发送群聊消息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#send_group_msg-%E5%8F%91%E9%80%81%E7%BE%A4%E6%B6%88%E6%81%AF
[发送消息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#send_msg-%E5%8F%91%E9%80%81%E6%B6%88%E6%81%AF
[撤回消息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#delete_msg-%E6%92%A4%E5%9B%9E%E6%B6%88%E6%81%AF
[群组踢人]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_kick-%E7%BE%A4%E7%BB%84%E8%B8%A2%E4%BA%BA
[群组单人禁言]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_ban-%E7%BE%A4%E7%BB%84%E5%8D%95%E4%BA%BA%E7%A6%81%E8%A8%80
[群组匿名禁言]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_anonymous_ban-%E7%BE%A4%E7%BB%84%E5%8C%BF%E5%90%8D%E7%94%A8%E6%88%B7%E7%A6%81%E8%A8%80
[群组全员禁言]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_whole_ban-%E7%BE%A4%E7%BB%84%E5%85%A8%E5%91%98%E7%A6%81%E8%A8%80
[群组设置管理员]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_admin-%E7%BE%A4%E7%BB%84%E8%AE%BE%E7%BD%AE%E7%AE%A1%E7%90%86%E5%91%98
[设置群名片（群备注）]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_card-%E8%AE%BE%E7%BD%AE%E7%BE%A4%E5%90%8D%E7%89%87%E7%BE%A4%E5%A4%87%E6%B3%A8
[设置群名]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_name-%E8%AE%BE%E7%BD%AE%E7%BE%A4%E5%90%8D
[退出群组]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_leave-%E9%80%80%E5%87%BA%E7%BE%A4%E7%BB%84
[设置群组专属头衔]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_special_title-%E8%AE%BE%E7%BD%AE%E7%BE%A4%E7%BB%84%E4%B8%93%E5%B1%9E%E5%A4%B4%E8%A1%94
[处理加好友请求]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_friend_add_request-%E5%A4%84%E7%90%86%E5%8A%A0%E5%A5%BD%E5%8F%8B%E8%AF%B7%E6%B1%82
[处理加群请求/邀请]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_add_request-%E5%A4%84%E7%90%86%E5%8A%A0%E7%BE%A4%E8%AF%B7%E6%B1%82%E9%82%80%E8%AF%B7
[群组单人禁言]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#set_group_ban-%E7%BE%A4%E7%BB%84%E5%8D%95%E4%BA%BA%E7%A6%81%E8%A8%80
[获取登录号信息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_login_info-%E8%8E%B7%E5%8F%96%E7%99%BB%E5%BD%95%E5%8F%B7%E4%BF%A1%E6%81%AF
[获取陌生人信息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_stranger_info-%E8%8E%B7%E5%8F%96%E9%99%8C%E7%94%9F%E4%BA%BA%E4%BF%A1%E6%81%AF
[获取好友列表]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_friend_list-%E8%8E%B7%E5%8F%96%E5%A5%BD%E5%8F%8B%E5%88%97%E8%A1%A8
[获取群信息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_group_info-%E8%8E%B7%E5%8F%96%E7%BE%A4%E4%BF%A1%E6%81%AF
[获取群列表]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_group_list-%E8%8E%B7%E5%8F%96%E7%BE%A4%E5%88%97%E8%A1%A8
[获取群成员信息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_group_member_info-%E8%8E%B7%E5%8F%96%E7%BE%A4%E6%88%90%E5%91%98%E4%BF%A1%E6%81%AF
[获取群成员列表]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_group_member_list-%E8%8E%B7%E5%8F%96%E7%BE%A4%E6%88%90%E5%91%98%E5%88%97%E8%A1%A8
[获取版本信息]: https://github.com/botuniverse/onebot-11/blob/master/api/public.md#get_version_info-%E8%8E%B7%E5%8F%96%E7%89%88%E6%9C%AC%E4%BF%A1%E6%81%AF

### 从 go-cqhttp cv 过来的api

| 拓展 API                    | 功能                    |
| --------------------------- | ---------------------- |
| set_group_portrait         | [设置群头像]             |
| get_msg                    | [获取消息]               |
| get_forward_msg            | [获取合并转发内容]        |
| send_private_forward_msg   | [发送合并转发(私聊)]      |
| send_group_forward_msg     | [发送合并转发(群聊)]      |
| get_group_system_msg       | [获取群系统消息]          |
| get_group_root_files       | [获取群根目录文件列表]     |
| get_group_files_by_folder  | [获取群子目录文件列表]     |
| get_group_file_url         | [获取群文件资源链接]       |
| get_status                 | [获取状态]                |

[设置群头像]: https://docs.go-cqhttp.org/api/#%E8%AE%BE%E7%BD%AE%E7%BE%A4%E5%A4%B4%E5%83%8F
[获取消息]: https://docs.go-cqhttp.org/api/#%E8%8E%B7%E5%8F%96%E6%B6%88%E6%81%AF
[获取合并转发内容]: https://docs.go-cqhttp.org/api/#%E8%8E%B7%E5%8F%96%E5%90%88%E5%B9%B6%E8%BD%AC%E5%8F%91%E5%86%85%E5%AE%B9
[发送合并转发(私聊)]: https://docs.go-cqhttp.org/api/#%E5%8F%91%E9%80%81%E5%90%88%E5%B9%B6%E8%BD%AC%E5%8F%91-%E5%A5%BD%E5%8F%8B
[发送合并转发(群聊)]: https://docs.go-cqhttp.org/api/#%E5%8F%91%E9%80%81%E5%90%88%E5%B9%B6%E8%BD%AC%E5%8F%91-%E7%BE%A4
[获取群系统消息]: https://docs.go-cqhttp.org/api/#%E8%8E%B7%E5%8F%96%E7%BE%A4%E7%B3%BB%E7%BB%9F%E6%B6%88%E6%81%AF
[获取群根目录文件列表]: https://docs.go-cqhttp.org/api/#%E8%8E%B7%E5%8F%96%E7%BE%A4%E6%A0%B9%E7%9B%AE%E5%BD%95%E6%96%87%E4%BB%B6%E5%88%97%E8%A1%A8
[获取群子目录文件列表]: https://docs.go-cqhttp.org/api/#%E8%8E%B7%E5%8F%96%E7%BE%A4%E5%AD%90%E7%9B%AE%E5%BD%95%E6%96%87%E4%BB%B6%E5%88%97%E8%A1%A8
[获取群文件资源链接]: https://docs.go-cqhttp.org/api/#%E8%8E%B7%E5%8F%96%E7%BE%A4%E6%96%87%E4%BB%B6%E8%B5%84%E6%BA%90%E9%93%BE%E6%8E%A5
[获取状态]: https://docs.go-cqhttp.org/api/#%E8%8E%B7%E5%8F%96%E7%8A%B6%E6%80%81

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
| 请求事件  | [加好友请求]      |
| 请求事件  | [加群请求/邀请]   |

[群管理员变动]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E7%BE%A4%E7%AE%A1%E7%90%86%E5%91%98%E5%8F%98%E5%8A%A8
[群成员减少]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E7%BE%A4%E6%88%90%E5%91%98%E5%87%8F%E5%B0%91
[群成员增加]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E7%BE%A4%E6%88%90%E5%91%98%E5%A2%9E%E5%8A%A0
[群禁言]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E7%BE%A4%E7%A6%81%E8%A8%80
[好友添加]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E5%A5%BD%E5%8F%8B%E6%B7%BB%E5%8A%A0
[群消息撤回]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E7%BE%A4%E6%B6%88%E6%81%AF%E6%92%A4%E5%9B%9E
[好友消息撤回]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E5%A5%BD%E5%8F%8B%E6%B6%88%E6%81%AF%E6%92%A4%E5%9B%9E
[群内戳一戳]: https://github.com/botuniverse/onebot-11/blob/master/event/notice.md#%E7%BE%A4%E5%86%85%E6%88%B3%E4%B8%80%E6%88%B3
[加好友请求]: https://github.com/botuniverse/onebot-11/blob/master/event/request.md#%E5%8A%A0%E5%A5%BD%E5%8F%8B%E8%AF%B7%E6%B1%82
[加群请求/邀请]: https://github.com/botuniverse/onebot-11/blob/master/event/request.md#%E5%8A%A0%E7%BE%A4%E8%AF%B7%E6%B1%82%E9%82%80%E8%AF%B7

</details>

## TODO

1.  更详细的帮助和设置
2.  支持更多onebot api
3.  支持onebot v12

## 鸣谢

* [miao-plugin](https://gitee.com/yoimiya-kokomi/miao-plugin) : 使用的ui代码及实现均来自miao-plugin
* [@idanran](https://github.com/idanran) : QQNT 部分代码来源
* [xiaofei-plugin](https://gitee.com/xfdown/xiaofei-plugin) : 音乐自定义分享授权使用
* [yenai-plugin](https://www.yenai.ren/) : components部分代码来源
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