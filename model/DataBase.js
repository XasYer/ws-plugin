import { Config } from '../components/index.js'
import {
  saveMessage_id,
  findMessage_id,
  existSQL,
  findUser_id,
  saveUser_id,
  updateUser_id,
  findGroup_id,
  saveGroup_id,
  updateGroup_id
} from './db/index.js'

let latestMsg = {}

async function getMsg (where, other) {
  if (Object.hasOwnProperty.call(where, 'message_id') && where.message_id == undefined) {
    return null
  }
  if (existSQL) {
    return await findMessage_id(where, other)
  } else {
    let key = where.onebot_id || where.message_id
    let msg = await redis.get(`Yz:ws-plugin:msg:${key}`)
    if (!msg) {
      return null
    }
    return JSON.parse(msg)
  }
}

async function setMsg(value) {
  // 处理数组形式的message_id
  if (Array.isArray(value.message_id)) {
    value.message_id = value.message_id[0];
  }
  
  // 为来自NoneBot的消息补充可能缺失的seq和rand值
  if (!value.seq) value.seq = Date.now();
  if (!value.rand) value.rand = Math.floor(Math.random() * 1000000);
  
  if (existSQL) {
    await saveMessage_id(value);
  } else {
    const EX = Config.msgStoreTime;
    if (EX > 0) {
      await redis.set(`Yz:ws-plugin:msg:${value.onebot_id || value.message_id}`, JSON.stringify(value), { EX });
      await redis.set(`Yz:ws-plugin:msg:${value.message_id}`, JSON.stringify(value), { EX });
    }
  }
}

/**
 * 小于五分钟才会返回
 * @param {*} id
 * @returns
 */
function getLatestMsg (id) {
  const data = latestMsg[id]
  if (data && Math.floor(Date.now() / 1000) - data.time < 5 * 60) {
    return data
  }
  return null
}

/**
 * 设置对应的id的最新数据
 * @param {string|number} id
 * @param {Object} data
 * @param {number} data.time 一般用于QQBot
 * @param {Function|null} data.reply 一般用于QQBot
 * @param {string} data.message_id 一般用于QQGuild
 */
function setLatestMsg (id, data) {
  latestMsg[id] = data
}

async function getUser_id (where) {
  if (where.user_id) {
    if (!isNaN(Number(where.user_id))) {
      return Number(where.user_id)
    }
    where.user_id = String(where.user_id)
  }
  let data = await findUser_id(where)
  if (!data) {
    if (where.user_id) {
      data = await saveUser_id(where.user_id)
    } else {
      return where.custom || where.id
    }
  }
  if (where.user_id) {
    return Number(data.custom) || data.id
  } else {
    return data.user_id
  }
}

async function setUser_id (where, custom) {
  const user_id = Number(custom)
  if (isNaN(user_id)) {
    return '输入有误,ID应为纯数字'
  }
  const result = await updateUser_id(where, user_id)
  if (result[0]) {
    return `修改成功~\n${where.user_id} => ${custom}`
  }
  return '修改失败,未包含此ID'
}

async function getGroup_id (where) {
  if (where.group_id) {
    if (!isNaN(Number(where.group_id))) {
      return Number(where.group_id)
    }
    where.group_id = String(where.group_id)
  }
  let data = await findGroup_id(where)
  if (!data) {
    if (where.group_id) {
      data = await saveGroup_id(where.group_id)
    } else {
      return where.custom || where.id
    }
  }
  if (where.group_id) {
    return Number(data.custom) || data.id
  } else {
    return data.group_id
  }
}

async function setGroup_id (where, custom) {
  const group_id = Number(custom)
  if (isNaN(group_id)) {
    return '输入有误,ID应为纯数字'
  }
  const result = await updateGroup_id(where, group_id)
  if (result[0]) {
    return `修改成功~\n${where.group_id} => ${custom}`
  }
  return '修改失败,未包含此ID'
}

export {
  getMsg,
  setMsg,
  getLatestMsg,
  setLatestMsg,
  getUser_id,
  setUser_id,
  getGroup_id,
  setGroup_id
}
