//临时解决,后续想到什么办法了再改
const msgMap = new Map()
let keys = []

function getMsgMap(key) {
    let msg = msgMap.get(Number(key));
    if (!msg) {
        return null
    }
    return msg
}

/**
 * 把最近500条消息存起来,用于getMsg和deleteMsg
 * @param {*} key 
 * @param {*} value 
 */
function setMsgMap(key, value) {
    if (keys.length >= 500) {
        let firstKey = keys.shift();
        msgMap.delete(firstKey);
    }
    msgMap.set(key, value);
    keys.push(key);
}

function getLatestMsg() {
    let key = keys[keys.length - 1]
    let msg = getMsgMap(key)
    return msg
}

export {
    getMsgMap,
    setMsgMap,
    getLatestMsg
}