# ws-plugin

## 介绍
Yunzai-Bot 的扩展插件 ws-plugin 提供ontbot协议适配,通过ws连接onebot实现的bot


## 安装与更新

### 使用Git安装（推荐）

请将 ws-plugin 放置在 Yunzai-Bot 的 plugins 目录下，重启 Yunzai-Bot 后即可使用。

请使用 git 进行安装，以方便后续升级。在 Yunzai-Bot 根目录夹打开终端，运行下述指令之一

```
// 使用gitee
git clone --depth=1 https://gitee.com/xiaoye12123/ws-plugin.git ./plugins/ws-plugin/
pnpm i

```

进行安装。安装完毕后，管理员只需发送 `#ws更新` 即可自动更新 ws-plugin。

### 手工下载安装（不推荐）

手工下载安装包，解压后将`ws-plugin-master`更名为`ws-plugin`，然后放置在Yunzai的plugins目录内

虽然此方式能够使用，但无法使用`#ws更新`进行更新，不利于后续升级，故不推荐使用

## 功能说明

暂未完全开发完成,仅提供基础实现
当前可正常连接并使用部分功能

当前指令: 只支持主人私聊Bot
1.  #ws添加连接
2.  #ws删除连接
3.  #ws设置

以下指令全部人可用
1.  #ws版本

添加和删除之后会自动进行断开所有已连接的ws进行重连

## 反馈或建议

QQ群 [698673296](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=0xSHDCUDrVbiOKe7ksEi5xpxdmJj8VRT&authKey=gnMoAHGtaQcqlGg50M%2B6QvIvKsyzMrPymK0FjIxCe7mdzUM8rSIi2jvxWczaZEU5&noverify=0&group_code=698673296)

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