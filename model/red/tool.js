import fs from 'fs'
import { createHash, randomUUID } from 'crypto'
import { resolve, join, basename, extname } from 'path'
import fetch, { FormData, Blob } from 'node-fetch'
import { exec } from 'child_process'
import os from 'os'
import _ from 'lodash'
import { Stream } from "stream"
import YAML from 'yaml'
import { TMP_DIR, mimeTypes } from '../tool.js'

const user = os.userInfo().username
let redPath = `C:/Users/${user}/.chronocat`

const roleMap = {
    2: 'member',
    3: 'admin',
    4: 'owner'
}

async function uploadImg(bot, data, name) {
    let contentType = 'image/png'
    if (name && name.includes?.('.')) {
        contentType = mimeTypes[extname(name)] || contentType
    }
    if (/^.{32}\.image$/.test(data)) {
        data = `https://gchat.qpic.cn/gchatpic_new/0/0-0-${data.replace('.image', '').toUpperCase()}/0`
    }
    const file = await upload(bot, data, contentType)
    if (!file.imageInfo) throw "获取图片信息失败,请检查图片状态"
    let picType = 1000
    switch (file.imageInfo.type) {
        case 'gif':
            picType = 2000
            break;
        case 'png':
            picType = 1001
            break
        case 'webp':
            picType = 1002
            break
    }
    return {
        elementType: 2,
        picElement: {
            md5HexStr: file.md5,
            fileSize: file.fileSize,
            picHeight: file.imageInfo.height,
            picWidth: file.imageInfo.width,
            fileName: basename(file.ntFilePath),
            sourcePath: file.ntFilePath,
            picType
        }
    }
}

/**
 * @param {*} data 
 * @returns 
 */
async function getFileInfo(data) {
    let buffer, contentType
    if (data instanceof Stream.Readable) {
        buffer = fs.readFileSync(data.path)
        contentType = mimeTypes[extname(data.path)]
    } else if (Buffer.isBuffer(data)) {
        buffer = data
    } else if (data.match(/^base64:\/\//)) {
        buffer = Buffer.from(data.replace(/^base64:\/\//, ""), 'base64')
    } else if (data.startsWith('http')) {
        const img = await fetch(data)
        const type = img.headers.get('content-type');
        if (type) contentType = type
        const arrayBuffer = await img.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
    } else if (data.startsWith('file://')) {
        try {
            buffer = fs.readFileSync(data.replace(/^file:\/\//, ''))
        } catch (error) {
            buffer = fs.readFileSync(data.replace(/^file:\/\/\//, ''))
        }
        contentType = mimeTypes[extname(data)]
    } else {
        try {
            buffer = fs.readFileSync(data)
            contentType = mimeTypes[extname(data)]
        } catch (error) {
            buffer = Buffer.from(data, 'base64')
            contentType = 'image/png'
        }
    }
    return { buffer, contentType }
}

function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}

/**
 * 
 * @param {*} bot 
 * @param {*} data 需要upload的数据
 * @param {string} contentType 
 * @param {boolean} getBuffer 是否需要处理成buffer
 * @returns 
 */
async function upload(bot, data, contentType, getBuffer = true) {
    if (!data) throw { noLog: true }
    let buffer
    if (getBuffer) {
        const file = await getFileInfo(data)
        buffer = file.buffer
        if (file.contentType) {
            contentType = file.contentType
        }
    } else {
        buffer = data
    }
    const blob = new Blob([buffer], { type: contentType })
    const formData = new FormData()
    formData.append('file', blob, 'ws-plugin' + (getKeyByValue(mimeTypes, contentType) || contentType.split('/').pop()))
    const result = await bot.sendApi('POST', 'upload', formData)
    if (result.error) {
        throw result.error
    }
    result.contentType = contentType
    return result
}

async function uploadAudio(bot, data) {
    let buffer = (await getFileInfo(data)).buffer
    const head = buffer.subarray(0, 7)
    if (!head.includes('\x02#!SILK')) {
        const tmpPath = await saveTmp(buffer)
        const pcm = await audioTransPcm(tmpPath)
        buffer = Buffer.from(await silk.encode(pcm, 24000))
    }
    const duration = Math.round(silk.getDuration(buffer) / 1000)
    const result = await upload(bot, buffer, 'audio/amr', false)
    return {
        elementType: 4,
        pttElement: {
            md5HexStr: result.md5,
            fileSize: String(result.fileSize),
            fileName: basename(result.ntFilePath),
            filePath: result.ntFilePath,
            waveAmplitudes: [
                99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
            ],
            duration,
            formatType: 1
        }
    }
}

function audioTransPcm(tmpPath, samplingRate = '24000') {
    return new Promise((resolve, reject) => {
        const pcmPath = join(TMP_DIR, randomUUID({ disableEntropyCache: true }))
        exec(`ffmpeg -y -i "${tmpPath}" -ar ${samplingRate} -ac 1 -f s16le "${pcmPath}"`, async () => {
            fs.unlink(tmpPath, () => { })
            try {
                const pcm = fs.readFileSync(pcmPath)
                resolve(pcm)
            } catch {
                reject('音频转码失败, 请确保 ffmpeg 已正确安装')
            } finally {
                fs.unlink(pcmPath, () => { })
            }
        })
    })
}

async function saveTmp(data, ext = null) {
    ext = ext ? '.' + ext : ''
    const filename = randomUUID({ disableEntropyCache: true }) + ext
    const tmpPath = resolve(TMP_DIR, filename)
    fs.writeFileSync(tmpPath, data)
    return tmpPath
}

async function getNtPath(bot) {
    let dataPath
    try {
        const buffer = fs.readFileSync('./plugins/ws-plugin/resources/common/cont/logo.png')
        const blob = new Blob([buffer], { type: 'image/png' })
        const formData = new FormData()
        formData.append('file', blob, '1.png')
        const file = await bot.sendApi('POST', 'upload', formData)
        fs.unlinkSync(file.ntFilePath)
        const index = file.ntFilePath.indexOf('nt_data');
        dataPath = file.ntFilePath.slice(0, index + 'nt_data'.length);
    } catch (error) {
        return null
    }
    return dataPath
}

async function uploadVideo(bot, file) {
    let type = 'mp4'
    if (Buffer.isBuffer(file)) {
        const buffer = file
        file = join(TMP_DIR, randomUUID({ disableEntropyCache: true }) + '.' + type)
        fs.writeFileSync(file, buffer)
    } else if (file.match?.(/^base64:\/\//)) {
        const buffer = Buffer.from(file.replace(/^base64:\/\//, ""), 'base64')
        file = join(TMP_DIR, randomUUID({ disableEntropyCache: true }) + '.' + type)
        fs.writeFileSync(file, buffer)
    } else {
        file = file.replace(/file:\/{2,3}/, '')
        type = file.substring(file.lastIndexOf('.') + 1)
        const Temp = join(TMP_DIR, randomUUID({ disableEntropyCache: true }) + '.' + type)
        fs.copyFileSync(file, Temp)
        file = Temp
    }
    const ntPath = await getNtPath(bot)
    if (!ntPath) return
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = `${year}-${month.toString().padStart(2, '0')}`;
    const video = await getVideoInfo(file)

    let oriPath = ntPath
    for (const i of ['Video', date, 'Ori']) {
        oriPath = join(oriPath, i)
        if (!fs.existsSync(oriPath)) {
            fs.mkdirSync(oriPath)
        }
    }
    oriPath = `${oriPath}/${video.videoMd5}.${type}`

    let thumbPath = `${ntPath}/Video/${date}/Thumb`
    if (!fs.existsSync(thumbPath)) fs.mkdirSync(thumbPath)
    thumbPath = `${thumbPath}/${video.videoMd5}_0.png`

    fs.copyFileSync(file, oriPath)
    fs.unlinkSync(file)
    const thumb = await getThumbInfo(oriPath, thumbPath)
    return {
        elementType: 5,
        videoElement: {
            filePath: oriPath,
            fileName: video.videoMd5 + '.' + type,
            videoMd5: video.videoMd5,
            thumbMd5: thumb.thumbMd5,
            fileTime: video.fileTime,
            thumbSize: thumb.thumbSize,
            fileSize: video.fileSize,
            thumbWidth: thumb.thumbWidth,
            thumbHeight: thumb.thumbHeight
        }
    }
}

async function getVideoInfo(file) {
    const fileTime = await getVideoTime(file)
    const videoMd5 = await getVideoMd5(file)
    const fileSize = fs.readFileSync(file).length
    return {
        fileTime,
        videoMd5,
        fileSize
    }
}

function getVideoMd5(file) {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(file);
        const hash = createHash('md5');
        stream.on('data', chunk => {
            hash.update(chunk);
        });
        stream.on('end', () => {
            const md5 = hash.digest('hex');
            resolve(md5)
        });
    })
}

function getVideoTime(file) {
    return new Promise((resolve, reject) => {
        exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`, (error, stdout, stderr) => {
            if (error) {
                reject('获取视频长度失败, 请确保你的 ffmpeg 已正确安装')
            }
            const durationInSeconds = parseInt(stdout);
            resolve(durationInSeconds)
        });
    })
}

async function getThumbInfo(file, thumbPath) {

    const tempPath = join(TMP_DIR, randomUUID({ disableEntropyCache: true }) + '.jpg')

    const { thumbMd5, thumbSize } = await extractThumbnail(file, tempPath);

    const { thumbWidth, thumbHeight } = getImageSize(tempPath);

    fs.copyFileSync(tempPath, thumbPath)
    fs.unlinkSync(tempPath)

    return { thumbMd5, thumbWidth, thumbHeight, thumbSize };
}

function extractThumbnail(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        exec(`ffmpeg -i "${inputFile}" -ss 00:00:00.000 -vframes 1 -vf "scale=iw/3:ih/3" "${outputFile}"
        `, async () => {
            fs.access(outputFile, fs.constants.F_OK, (err) => {
                if (err) {
                    reject('获取视频封面失败, 请确保你的 ffmpeg 已正确安装')
                }
            })

            const buffer = fs.readFileSync(outputFile);
            const hash = createHash('md5');
            hash.update(buffer);
            resolve({
                thumbMd5: hash.digest('hex'),
                thumbSize: buffer.length
            })
        })
    })
}

function getImageSize(file) {
    const buffer = fs.readFileSync(file);
    const start = buffer.indexOf(Buffer.from([0xff, 0xc0]));
    const thumbHeight = buffer.readUInt16BE(start + 5);
    const thumbWidth = buffer.readUInt16BE(start + 7);
    return { thumbWidth, thumbHeight };
}

async function uploadFile(bot, data, name) {
    const ext = (typeof data === 'string' ? data : '') || name
    const result = await upload(bot, data, mimeTypes[extname(ext)])
    const fileName = basename(ext || result.ntFilePath)
    return {
        elementType: 3,
        fileElement: {
            fileMd5: result.md5,
            fileName,
            filePath: result.ntFilePath,
            fileSize: result.fileSize,
        }
    }
}

function getToken() {
    let tokenPath
    try {
        if (os.platform() === 'win32') {
            tokenPath = `${redPath}/config/chronocat.yml`
            const data = YAML.parse(fs.readFileSync(tokenPath, 'utf-8'))
            for (const i of data?.servers || []) {
                if (i.type === 'red') {
                    return i.token
                }
            }
            logger.error('[ws-plugin] 请检查chronocat配置是否开启red服务')
            return false
        } else {
            logger.error('[ws-plugin] 非Windows系统请自行获取Token')
            return false
        }
    } catch (error) {
        logger.error('[ws-plugin] 自动获取Token失败,请检查是否已安装Chronocat并尝试手动获取')
        logger.error(error)
        return false
    }
}

async function getSilk() {
    let silk
    try {
        silk = await import('silk-wasm')
        return silk
    } catch (error) {
        logger.warn('[ws-plugin] 未安装silk-wasm依赖,发送语音可能会失败');
    }
}
const silk = await getSilk()

export {
    uploadImg,
    uploadAudio,
    uploadVideo,
    uploadFile,
    getToken,
    getNtPath,
    roleMap,
    redPath,
    upload
}
