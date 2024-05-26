/**
 * cq码转换Msg
 * @param {*} cq
 */
function CQToMsg (cq) {
  let msg = []
  let matches = cq.matchAll(/(\[CQ:(.*?),(.*?)\]|.)/gs)
  let text = ''
  for (const match of matches) {
    if (match[2]) {
      if (text) {
        msg.push({
          type: 'text',
          data: {
            text
          }
        })
        text = ''
      }
      let type = match[2]
      let data = {}
      let pairs = match[3].split(',')
      for (const pair of pairs) {
        let [key, value] = pair.split('=')
        data[key] = value
      }
      msg.push({ type, data })
    } else {
      text += match[0]
    }
  }
  if (text) {
    msg.push({
      type: 'text',
      data: {
        text
      }
    })
  }
  return msg
}

/**
 * msg转换cq码
 * @param {*} msg
 * @returns
 */
function MsgToCQ (msg) {
  let cq = ''
  for (const item of msg) {
    if (item.type === 'text') {
      cq += item.data.text
    } else {
      let data = Object.entries(item.data).map(([key, value]) => `${key}=${value}`).join(',')
      cq += `[CQ:${item.type},${data}]`
    }
  }
  return cq
}

export {
  CQToMsg,
  MsgToCQ
}
