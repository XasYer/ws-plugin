import { makeSendMsg, makeForwardMsg,msgToOneBotMsg } from './makeMsg.js'
import { getMsgMap, setMsgMap, getGuildLatestMsgId, getLatestMsg } from './msgMap.js'
import { MsgToCQ } from './CQCode.js'
import { Version } from '../components/index.js'

async function getApiData(api, params = {}, name, self_id) {
    let sendRet = null
    let ResponseData = null
    let publicApi = {
        // --------------------------------------------------------
        // Bot 账号
        // 有关 Bot 账号的相关 API
        // --------------------------------------------------------

        // 获取登录号信息
        'get_login_info': async params => {
            ResponseData = {
                user_id: Bot.uin,
                nickname: Bot.nickname
            }
        },
        // 设置登录号资料  
        'set_qq_profile': async params => {
            // company公司 email邮箱 college学校 在icqq文档中没找到
            if (params.nickname) {
                await Bot.setNickname(params.nickname)
            }
            if (params.personal_note) {
                await Bot.setDescription(params.personal_note)
            }
        },
        // 获取企点账号信息
        // TODO qidian_get_account_info
        // 获取在线机型
        // TODO _get_model_show
        // 设置在线机型
        '_set_model_show': async params => {
            // TODO 不会改
        },
        // 获取当前账号在线客户端列表
        'get_online_clients': async params => {
            // TODO 不会获取
            ResponseData = {
                clients: []
            }
        },

        // --------------------------------------------------------
        // 好友信息
        // --------------------------------------------------------

        // 获取陌生人信息
        'get_stranger_info': async (params) => {
            ResponseData = await Bot.getStrangerInfo(params.user_id)
        },
        // 获取好友列表
        'get_friend_list': async params => {
            let list = await Bot.getFriendList()
            ResponseData = Array.from(list.values())
        },
        // 获取单向好友列表
        'get_unidirectional_friend_list': async params => {
            // 感觉不像这个
            ResponseData = Array.from(Bot.sl.values())
        },

        // --------------------------------------------------------
        // 好友操作
        // 好友操作 API
        // --------------------------------------------------------

        // 删除好友
        'delete_friend': async params => {
            await Bot.deleteFriend(params.user_id)
        },
        // 删除单向好友 
        // TODO delete_unidirectional_friend

        // --------------------------------------------------------
        // 消息
        // 有关消息操作的 API
        // --------------------------------------------------------

        // 发送私聊消息
        'send_private_msg': async (params) => {
            let { sendMsg, quote } = await makeSendMsg(params)
            sendRet = await Bot.sendPrivateMsg(params.user_id, sendMsg, quote)
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        // 发送群聊消息
        'send_group_msg': async (params) => {
            let { sendMsg, quote } = await makeSendMsg(params)
            sendRet = await Bot.sendGroupMsg(params.group_id, sendMsg, quote)
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        // 发送消息
        'send_msg': async (params) => {
            let { sendMsg, quote } = await makeSendMsg(params)
            if (params.message_type == 'group' || params.group_id) {
                sendRet = await Bot.sendGroupMsg(params.group_id, sendMsg, quote)
            } else if (params.message_type == 'private' || params.user_id) {
                sendRet = await Bot.sendPrivateMsg(params.user_id, sendMsg, quote)
            }
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        // 获取消息
        'get_msg': async (params) => {
            ResponseData = await getMsgMap(params.message_id)
            if (ResponseData) {
                ResponseData = await Bot.getMsg(ResponseData.message_id)
                ResponseData.group = ResponseData.isGroup
                ResponseData.real_id = ResponseData.seq
                ResponseData.message_id = ResponseData.rand
                ResponseData.message = msgToOneBotMsg(ResponseData.message)
            } else {
                throw { message: 'get_msg API error', noLog: true }
            }
        },
        // 撤回消息
        'delete_msg': async (params) => {
            let msg = await getMsgMap(params.message_id)
            if (msg) {
                await Bot.deleteMsg(msg.message_id)
            }
        },
        // 标记消息已读
        'mark_msg_as_read': async params => {
            // TODO
        },
        // 获取合并转发内容
        'get_forward_msg': async params => {
            let result = await Bot.getForwardMsg(params.message_id)
            let messages = []
            for (const item of result) {
                messages.push({
                    content: MsgToCQ(msgToOneBotMsg(item.message)),
                    sender: {
                        nickname: item.nickname,
                        user_id: item.user_id
                    },
                    time: item.time
                })
            }
            ResponseData = {
                messages
            }
        },
        // 发送合并转发 ( 群聊 )
        'send_group_forward_msg': async (params) => {
            let forwardMsg = await makeForwardMsg(params)
            let forward_id
            if (typeof (forwardMsg.data) === 'object') {
                let detail = forwardMsg.data?.meta?.detail
                if (detail) forward_id = detail.resid
            } else {
                let match = forwardMsg.data.match(/m_resid="(.*?)"/);
                if (match) forward_id = match[1];
            }
            sendRet = await Bot.pickGroup(params.group_id).sendMsg(forwardMsg)
            sendRet.forward_id = forward_id
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        // 发送合并转发 ( 好友 )
        'send_private_forward_msg': async (params) => {
            let forwardMsg = await makeForwardMsg(params)
            let forward_id
            if (typeof (forwardMsg.data) === 'object') {
                let detail = forwardMsg.data?.meta?.detail
                if (detail) forward_id = detail.resid
            } else {
                let match = forwardMsg.data.match(/m_resid="(.*?)"/);
                if (match) forward_id = match[1];
            }
            sendRet = await Bot.pickFriend(params.group_id).sendMsg(forwardMsg)
            sendRet.forward_id = forward_id
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        // 获取群消息历史记录
        'get_group_msg_history': async params => {
            let messages, flag = true
            if (params.message_seq) {
                let message_id = (await getMsgMap(params.message_seq))?.message_id
                if (message_id) {
                    messages = await Bot.getChatHistory(message_id)
                    flag = false
                }
            }
            if (flag) {
                messages = await Bot.pickGroup(params.group_id).getChatHistory()
            }
            if (message) {
                messages.map(i => msgToOneBotMsg(i.message))
            }
            ResponseData = {
                messages
            }
        },

        // --------------------------------------------------------
        // 图片
        // 图片相关 API
        // --------------------------------------------------------

        // 获取图片信息
        // TODO get_image 不会
        // 检查是否可以发送图片
        // TODO can_send_image 不会
        // 图片 OCR
        // TODO ocr_image .ocr_image 没找到例子

        // --------------------------------------------------------
        // 语音
        // 语音相关 API
        // --------------------------------------------------------

        // 获取语音
        // TODO get_record
        // 检查是否可以发送语音
        // TODO can_send_record 不会

        // --------------------------------------------------------
        // 处理
        // 上报处理相关 API
        // --------------------------------------------------------

        // 处理加好友请求
        'set_friend_add_request': async params => {
            let ret = (await Bot.getSystemMsg()).filter(i => i.request_type == 'friend' && i.flag == params.flag)
            if (ret.length > 0) {
                ret = ret[0]
                if (ret.approve(params.approve)) {
                    if (params.remark) {
                        Bot.pickFriend(ret.user_id).setRemark(params.remark)
                    }
                }
            }
        },
        // 处理加群请求／邀请
        'set_group_add_request': async params => {
            let type = params.sub_type || params.type
            let ret = (await Bot.getSystemMsg()).filter(i => i.request_type == 'group' && i.sub_type == type && i.flag == params.flag)
            if (ret.length > 0) {
                ret = ret[0]
                ret.approve(params.approve)
                // 不会写拒绝理由捏
            }
        },

        // --------------------------------------------------------
        // 群信息
        // 群信息相关 API
        // --------------------------------------------------------

        // 获取群信息
        'get_group_info': async params => {
            ResponseData = await Bot.getGroupInfo(params.group_id)
            ResponseData.group_memo = ResponseData.group_name
            ResponseData.group_create_time = ResponseData.create_time
            ResponseData.group_level = ResponseData.grade
        },
        // 获取群列表
        'get_group_list': async params => {
            let list = await Bot.getGroupList()
            list = Array.from(list.values())
            list.map(item => {
                item.group_memo = item.group_name
                item.group_create_time = item.create_time
                item.group_level = item.grade
            })
            ResponseData = list
        },
        // 获取群成员信息
        'get_group_member_info': async (params) => {
            ResponseData = await Bot.getGroupMemberInfo(params.group_id, params.user_id);
            ResponseData.shut_up_timestamp = ResponseData.shutup_time
        },
        // 获取群成员列表
        'get_group_member_list': async (params) => {
            let list = await Bot.getGroupMemberList(params.group_id)
            list = Array.from(list.values())
            list.map(item => {
                item.shut_up_timestamp = item.shutup_time
            })
            ResponseData = list
        },
        // 获取群荣誉信息
        // TODO get_group_honor_info
        // 获取群系统消息
        'get_group_system_msg': async params => {
            let invited_requests = []
            let join_requests = []
            for (const i of await Bot.getSystemMsg()) {
                if (i.request_type == 'group') {
                    switch (i.sub_type) {
                        case 'add':
                            join_requests.push({
                                request_id: i.seq,
                                requester_uin: i.user_id,
                                requester_nick: i.nickname,
                                message: i.comment,
                                group_id: i.group_id,
                                group_name: i.group_name,
                                checked: false, //好像这个只能获取没处理的
                                actor: 0
                            })
                            break;
                        case 'invite':
                            invited_requests.push({
                                request_id: i.seq,
                                invitor_uin: i.user_id,
                                invitor_nick: i.nickname,
                                group_id: i.group_id,
                                group_name: i.group_name,
                                checked: false, //同上
                                actor: 0
                            })
                            break;
                        default:
                            break;
                    }
                }
            }
            ResponseData = {
                invited_requests,
                join_requests
            }
        },
        // 获取精华消息列表
        // TODO get_essence_msg_list
        // 获取群 @全体成员 剩余次数
        'get_group_at_all_remain': async params => {
            let ret = await Bot.pickGroup(params.group_id)
            ResponseData = {
                can_at_all: ret.is_admin,
                // 群内所有管理当天剩余 @全体成员 次数 不会获取捏
                remain_at_all_count_for_group: ret.getAtAllRemainder(),
                remain_at_all_count_for_uin: ret.getAtAllRemainder()
            }
        },

        // --------------------------------------------------------
        // 群设置
        // 群设置相关 API
        // --------------------------------------------------------

        // 设置群名
        'set_group_name': async params => {
            await Bot.setGroupName(params.group_id, params.group_name)
        },
        // 设置群头像
        'set_group_portrait': async params => {
            await Bot.setGroupPortrait(params.group_id, params.file)
        },
        // 设置群管理员
        'set_group_admin': async params => {
            await Bot.setGroupAdmin(params.group_id, params.user_id, params.enable)
        },
        // 设置群名片 ( 群备注 )
        'set_group_card': async params => {
            await Bot.setGroupCard(params.group_id, params.user_id, params.card)
        },
        //设置群组专属头衔
        'set_group_special_title': async params => {
            await Bot.setGroupSpecialTitle(params.group_id, params.user_id, params.special_title, params.duration || -1)
        },

        // --------------------------------------------------------
        // 群操作
        // 群操作相关 API
        // --------------------------------------------------------

        // 群单人禁言
        'set_group_ban': async (params) => {
            await Bot.setGroupBan(params.group_id, params.user_id, params.duration)
        },
        // 群全员禁言
        'set_group_whole_ban': async params => {
            await Bot.setGroupWholeBan(params.group_id, params.enable)
        },
        // 群匿名用户禁言
        'set_group_anonymous_ban': async params => {
            let flag = params.anonymous?.flag || params.anonymous_flag || params.flag
            await Bot.setGroupAnonymousBan(params.group_id,flag,params.duration)
        },
        // 设置精华消息
        'set_essence_msg': async params => {
            let message_id = (await getMsgMap(params.message_id))?.message_id
            if (message_id) await Bot.setEssenceMessage(message_id)
        },
        // 移出精华消息
        'delete_essence_msg': async params => {
            let message_id = (await getMsgMap(params.message_id))?.message_id
            if (message_id) await Bot.removeEssenceMessage(message_id)
        },
        // 群打卡
        'send_group_sign': async params => {
            await Bot.sendGroupSign(params.group_id)
        },
        // 群设置匿名
        'set_group_anonymous': async params => {
            await Bot.setGroupAnonymous(params.group_id, params.enable)
        },
        // 发送群公告
        '_send_group_notice': async params => {
            await Bot.sendGroupNotice(params.group_id, params.content)
        },
        // 获取群公告
        // TODO _get_group_notice 不会
        // 群组踢人
        'set_group_kick': async params => {
            await Bot.setGroupKick(params.group_id, params.user_id, params.reject_add_request || false)
        },
        // 退出群组
        'set_group_leave': async params => {
            await Bot.setGroupLeave(params.group_id)
        },

        // --------------------------------------------------------
        // 文件
        // --------------------------------------------------------

        // 上传群文件
        'upload_group_file': async params => {
            await Bot.pickGroup(params.group_id).fs.upload(params.file, params.folder || '/', params.name)
        },
        // 删除群文件
        'delete_group_file': async params => {
            await Bot.pickGroup(params.group_id).fs.rm(params.file_id)
        },
        // 创建群文件文件夹
        'create_group_file_folder': async params => {
            await Bot.pickGroup(params.group_id).fs.mkdir(params.name)
        },
        // 删除群文件文件夹
        'delete_group_folder': async params => {
            await Bot.pickGroup(params.group_id).fs.rm(params.folder_id)
        },
        // 获取群文件系统信息
        'get_group_file_system_info': async params => {
            let ret = await Bot.pickGroup(params.group_id).fs.df()
            ResponseData = {
                file_count: ret.file_count,
                limit_count: ret.max_file_count,
                used_space: ret.used,
                total_space: ret.total
            }
        },
        // 获取群根目录文件列表
        'get_group_root_files': async (params) => {
            let list = await Bot.pickGroup(params.group_id).fs.ls()
            let files = []
            let folders = []
            let nickname = {}
            if (Array.isArray(list) && list.length > 0) {
                for (const item of list) {
                    let user_id = item.user_id
                    if (!nickname[user_id]) {
                        nickname[user_id] = (await Bot.getStrangerInfo(item.user_id)).nickname
                    }
                    if (item.is_dir) {
                        folders.push({
                            group_id: params.group_id,
                            folder_id: item.fid,
                            folder_name: item.name,
                            create_time: item.create_time,
                            creator: item.user_id,
                            creator_name: nickname[user_id],
                            total_file_count: item.file_count
                        })
                    } else {
                        files.push({
                            group_id: params.group_id,
                            file_id: item.fid,
                            file_name: item.name,
                            busid: item.busid,
                            file_size: item.size,
                            upload_time: item.create_time,
                            dead_time: item.duration,
                            modify_time: item.create_time,
                            download_times: item.download_times,
                            uploader: item.user_id,
                            uploader_name: nickname[user_id]
                        })
                    }
                }
            }
            ResponseData = {
                files,
                folders
            }
        },
        // 获取群子目录文件列表
        'get_group_files_by_folder': async params => {
            let list = await Bot.pickGroup(params.group_id).fs.ls(params.folder_id)
            let files = []
            let folders = []
            let nickname = {}
            if (Array.isArray(list) && list.length > 0) {
                for (const item of list) {
                    let user_id = item.user_id
                    if (!nickname[user_id]) {
                        nickname[user_id] = (await Bot.getStrangerInfo(item.user_id)).nickname
                    }
                    if (item.is_dir) {
                        folders.push({
                            group_id: params.group_id,
                            folder_id: item.fid,
                            folder_name: item.name,
                            create_time: item.create_time,
                            creator: item.user_id,
                            creator_name: nickname[user_id],
                            total_file_count: item.file_count
                        })
                    } else {
                        files.push({
                            group_id: params.group_id,
                            file_id: item.fid,
                            file_name: item.name,
                            busid: item.busid,
                            file_size: item.size,
                            upload_time: item.create_time,
                            dead_time: item.duration,
                            modify_time: item.create_time,
                            download_times: item.download_times,
                            uploader: item.user_id,
                            uploader_name: nickname[user_id]
                        })
                    }
                }
            }
            ResponseData = {
                files,
                folders
            }
        },
        // 获取群文件资源链接
        'get_group_file_url': async params => {
            let file = await Bot.pickGroup(params.group_id).fs.download(params.file_id)
            ResponseData = {
                url: file.url
            }
        },
        // 上传私聊文件
        'upload_private_file': async params => {
            await Bot.pickFriend(params.user_id).sendFile(params.file, params.name)
        },

        // --------------------------------------------------------
        // Go-CqHttp 相关
        // 获取 Cookies
        // --------------------------------------------------------

        // 获取 Cookies
        'get_cookies': async params => {
            ResponseData = {
                cookies: await Bot.getCookies(params.domain || null)
            }
        },
        // 获取 CSRF Token
        'get_csrf_token': async params => {
            ResponseData = {
                token: await Bot.getCsrfToken()
            }
        },
        // 获取 QQ 相关接口凭证
        'get_credentials': async params => {
            ResponseData = {
                cookies: await Bot.getCookies(params.domain || null),
                token: await Bot.getCsrfToken()
            }
        },
        // 获取版本信息
        'get_version_info': async params => {
            ResponseData = {
                app_name: 'ws-plugin',
                app_version: Version.version,
                protocol_version: 'v11'
            }
        },
        // 获取状态
        'get_status': async params => {
            ResponseData = {
                online: Bot.isOnline(),
                good: Bot.isOnline(),
                app_initialized: true,
                app_enabled: true,
                plugins_good: true,
                app_good: true,
                stat: {
                    packet_receivend: Bot.stat.recv_pkt_cnt,
                    packet_send: Bot.stat.sent_pkt_cnt,
                    packet_lost: Bot.stat.lost_pkt_cnt,
                    message_received: Bot.stat.recv_msg_cnt,
                    message_send: Bot.stat.sent_msg_cnt,
                    disconnect_times: 0,
                    lost_times: Bot.stat.lost_times,
                    last_message_time: getLatestMsg()?.time || 0
                }
            }
        },
        // 重启 Go-CqHttp
        // set_restart 什么?已经没了? 
        // 清理缓存
        'clean_cache': async params => {
            await Bot.cleanCache()
        },
        // 重载事件过滤器
        // TODO reload_event_filter 这是啥
        // 下载文件到缓存目录
        // TODO download_file 这又是啥
        // 检查链接安全性
        // TODO check_url_safely 不会
        // 获取中文分词 ( 隐藏 API )
        // .get_word_slices
        // 对事件执行快速操作 ( 隐藏 API )
        // .handle_quick_operation


        'send_guild_channel_msg': async params => {
            let { sendMsg } = await makeSendMsg(params)
            sendMsg.unshift({
                type: 'reply',
                data: {
                    id: getGuildLatestMsgId()
                }
            })
            await Bot[self_id].pickGroup(`qg_${params.guild_id}-${params.channel_id}`).sendMsg(sendMsg)
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        'get_guild_service_profile': async params => {
            ResponseData = {
                avatar_url: Bot.pickFriend(Bot.uin).getAvatarUrl(),
                nickname: Bot.nickname,
                tiny_id: Bot.tiny_id
            }
        },
        'get_guild_list': async params => {
            ResponseData = await Bot.getGuildList()
        },

    }
    if (typeof publicApi[api] === 'function') {
        await publicApi[api](params)
        if (sendRet) {
            ResponseData = {
                ...sendRet,
                message_id: sendRet.rand,
            }
            await setMsgMap(sendRet.rand, sendRet)
        }
        return ResponseData
    } else {
        logger.warn(`未适配的api: ${api}`);
    }
}

export {
    getApiData
}