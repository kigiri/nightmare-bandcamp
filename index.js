const fs = require('fs')
const filesize = require('filesize')
const path = require('path')
const request = require('request')
const progress = require('progress-stream')
const Nightmare = require('nightmare')
const sequences = require('promise-sequences')
const partialRight = require('lodash.partialright')
const mkdirp = require('mkdirp')
const unzip = require('unzip-wrapper')
const TEMP_DIR = path.join(require('os').tmpdir(), 'bandcamp')
const promisify = fn => (...args) => new Promise((s,f) =>
    fn(...args, err => err ? f(err) : s()))

const mkdirpAsync = promisify(mkdirp)
const unzipAsync = promisify(unzip)

const bandCampUrl = 'https://bandcamp.com/login'
const bandCampLogoutUrl = 'https://bandcamp.com/logout'
const usernameInputSelector = '#username-field'
const passwordInputSelector = '#password-field'
const submitButtonSelector = '#submit'
const downloadItemLinkSelectors = '.collection-item-container > div.collection-item-details-container > span.redownload-item > a'
const downloadButtonSelector = 'div.download-rightcol > .downloadStatus > .downloadGo'

const options = {
    show: process.env['NB_SHOW'] || false,
    format: 'Ogg Vorbis', //todo expose, collect available and fallback with highest possible
    concurrent: process.env['NB_CONBURRENT'] || 1,
    username: process.env['NB_USER'],
    password: process.env['NB_PASS'],
    destination: process.env['NB_DEST'],
}

if (!options.destination) {
    options.destination = path.join(process.cwd(), 'downloads')
    console.log('To download to a custom location use "NB_DEST" ENV variable to set the destination')
}
options.unzipDestination = path.join(options.destination, 'music')
options.zipDestination = path.join(options.destination, 'zips')

mkdirp.sync(options.zipDestination)
mkdirp.sync(options.unzipDestination)
mkdirp.sync(TEMP_DIR)

console.log(`Download temp dir ${TEMP_DIR}`)
console.log(`Downloading music to ${options.destination}`)
console.log(`Logging in as user ${options.username}`)

new Nightmare(options)
    .use(nightmare => nightmare
        .goto(bandCampLogoutUrl)
        .goto(bandCampUrl)
        .type(usernameInputSelector, '')
        .type(usernameInputSelector, options.username)
        .type(passwordInputSelector, '')
        .type(passwordInputSelector, options.password)
        .click(submitButtonSelector)
        .wait())
    .wait('#collection-container')
    .use(nightmare => nightmare.evaluate(() => {
        const links = document.querySelectorAll(downloadItemLinkSelectors)
        return Array.prototype.map.call(links, link => link.href)
    }))
    .end()
    .then(urls => {
        console.log(`Found ${urls.length} to download`)
        return urls
    })
    .then(urls => {
        console.log(`About to download ${urls.length} albums, ${options.concurrent} at a time`)
        
        const tasks = urls.map(url => () => downloadAlbum(url))
        return sequences.seriesSettled(tasks, options.concurrent)
    })
    .then((result) => {
        console.log('\\m/ your bandcamp collection is now downloaded, keep it growing!')
        console.log(result)
        process.exit(0)
    })
    .catch((error) => {
        console.error('Run error')
        console.error(error)
        process.exit(1)
    })

const downloadAlbum = url => getAlbumDownloadLink(url)
    .then(downloadBandcampZip)
    .then(unzipMusic)

const unzipMusic = zipResult => {
    const target = path.join(options.unzipDestination, zipResult.musicName)

    return mkdirpAsync(target)
        .then(() => unzipAsync(zipResult.zipPath, { target, fix: true }))
        .then(() => console.log(`Unzipping ${target} done!`))
}

const getAlbumDownloadLink = (url, options) => new Nightmare(options)
    .useragent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.110 Safari/537.36")
    .goto(url)
    .wait(downloadButtonSelector)
    .wait(1000)
    .click('#downloadFormatMenu0')
    .wait('#formatMenu2')
    .wait(downloadButtonSelector)
    .wait(2000)
    .evaluate(format => {
        // something fishy about the bandcamp site requires the mouseenter
        $(`.ui-menu-item[data-value=${format}]`).trigger('mouseenter')
        $(`.ui-menu-item[data-value=${format}]`).click()
    }, options.format)
    .wait(2000)
    .wait(downloadButtonSelector)
    .evaluate(query => document.querySelector(query).href, downloadButtonSelector)
    .end()

const downloadBandcampZip = (musicLink, options) => new Promise((s, f) => {
    let musicName = `download-${Date.now()}`
    const downloadFileName = path.join(TEMP_DIR, (new Date().getTime()) + '.zip')
    const progressStream = progress({time: 1000})
        .on('progress', progress => console.log(`downloaded ${Math.round(progress.percentage)}% of ${musicLink}`))
        .on('finish', () => {
            const zipFileName = musicName + '.zip'
            const zipPath = path.join(options.zipDestination, zipFileName)
            fs.rename(downloadFileName, zipPath, () =>
                s({ zipFileName, musicName, zipPath }))
        })

    request
        .get(musicLink)
        .on('error', f)
        .on('response', response => {
            progressStream.setLength(response.headers['content-length'])
            const contentDisposition = response.headers['content-disposition']
            console.log(`Downloading zip file ${filesize(response.headers['content-length'])}`)

            if (contentDisposition !== undefined) {
                const fileNameMatch = /(?:filename\*=UTF-8'')(.*)(?:.zip)/.exec(contentDisposition)
                if (!fileNameMatch[1]) {
                    return console.error('unable to determine filename from the response headers')
                }
                musicName = `${decodeURIComponent(fileNameMatch[1])}`
            }
        })
        .pipe(progressStream)
        .pipe(fs.createWriteStream(downloadFileName))
})
