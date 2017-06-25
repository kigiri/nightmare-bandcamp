const fs = require('fs')
const filesize = require('filesize')
const path = require('path')
const request = require('request')
const progress = require('progress-stream')
const Nightmare = require('nightmare')
const sequences = require('promise-sequences')
const mkdirp = require('mkdirp')
const unzip = require('unzip-wrapper')
const TEMP_DIR = path.join('.', 'bandcamp')
const promisify = fn => (...args) => new Promise((s,f) =>
  fn(...args, err => err ? f(err) : s()))

const mkdirpAsync = promisify(mkdirp)
const unzipAsync = promisify(unzip)

const bandCampUrl = 'https://bandcamp.com/login'
const bandCampLogoutUrl = 'https://bandcamp.com/logout'
const usernameInputSelector = '#username-field'
const passwordInputSelector = '#password-field'
const submitButtonSelector = '#loginform button[type="submit"]'
const downloadItemLinkSelectors = '.collection-item-container > div.collection-item-details-container > span.redownload-item > a'
const downloadButtonSelector = '.download-title a.item-button'

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


const urls = [
  "https://bandcamp.com/download?from=collection&payment_id=3305607102&sig=21b7ea10dfe63033793408654a615c12&sitem_id=48798430",
  "https://bandcamp.com/download?from=collection&payment_id=1698069978&sig=b5fa38636f078f4f3778eadbc38613f7&sitem_id=49976400",
  "https://bandcamp.com/download?from=collection&payment_id=961506685&sig=c0641c39093ed3a3a3f97873c4ec3075&sitem_id=48736530",
  "https://bandcamp.com/download?from=collection&payment_id=1345061378&sig=edeb41cd283b34500d65b5d1c8b170c4&sitem_id=46099633",
  "https://bandcamp.com/download?from=collection&payment_id=1345061378&sig=edeb41cd283b34500d65b5d1c8b170c4&sitem_id=46099634",
  "https://bandcamp.com/download?from=collection&payment_id=1345061378&sig=edeb41cd283b34500d65b5d1c8b170c4&sitem_id=46099635",
  "https://bandcamp.com/download?from=collection&payment_id=1345061378&sig=edeb41cd283b34500d65b5d1c8b170c4&sitem_id=46099636",
  "https://bandcamp.com/download?from=collection&payment_id=1345061378&sig=edeb41cd283b34500d65b5d1c8b170c4&sitem_id=46099637",
  "https://bandcamp.com/download?from=collection&payment_id=2710631464&sig=b15c93988b7063865408b6dc9ffa8ea7&sitem_id=37964618",
  "https://bandcamp.com/download?from=collection&payment_id=2710631464&sig=b15c93988b7063865408b6dc9ffa8ea7&sitem_id=37964613",
  "https://bandcamp.com/download?from=collection&payment_id=2710631464&sig=b15c93988b7063865408b6dc9ffa8ea7&sitem_id=37964606",
  "https://bandcamp.com/download?from=collection&payment_id=3711970157&sig=df8d6a56f3589c5730ed57872dd7336f&sitem_id=36717212",
  "https://bandcamp.com/download?from=collection&payment_id=3711970157&sig=df8d6a56f3589c5730ed57872dd7336f&sitem_id=36717236",
  "https://bandcamp.com/download?from=collection&payment_id=3711970157&sig=df8d6a56f3589c5730ed57872dd7336f&sitem_id=36717218",
  "https://bandcamp.com/download?from=collection&payment_id=3711970157&sig=df8d6a56f3589c5730ed57872dd7336f&sitem_id=36717232",
  "https://bandcamp.com/download?from=collection&payment_id=3711970157&sig=df8d6a56f3589c5730ed57872dd7336f&sitem_id=36717260",
  "https://bandcamp.com/download?from=collection&payment_id=3711970157&sig=df8d6a56f3589c5730ed57872dd7336f&sitem_id=36717237",
  "https://bandcamp.com/download?from=collection&payment_id=3711970157&sig=df8d6a56f3589c5730ed57872dd7336f&sitem_id=36717230",
  "https://bandcamp.com/download?from=collection&payment_id=3711970157&sig=df8d6a56f3589c5730ed57872dd7336f&sitem_id=36717215",
  "https://bandcamp.com/download?from=collection&payment_id=3711970157&sig=df8d6a56f3589c5730ed57872dd7336f&sitem_id=36717240",
  "https://bandcamp.com/download?from=collection&payment_id=3711970157&sig=df8d6a56f3589c5730ed57872dd7336f&sitem_id=36717224",
  "https://bandcamp.com/download?from=collection&payment_id=3711970157&sig=df8d6a56f3589c5730ed57872dd7336f&sitem_id=36717228",
  "https://bandcamp.com/download?from=collection&payment_id=3711970157&sig=df8d6a56f3589c5730ed57872dd7336f&sitem_id=36717235",
  "https://bandcamp.com/download?from=collection&payment_id=3711970157&sig=df8d6a56f3589c5730ed57872dd7336f&sitem_id=36717242",
  "https://bandcamp.com/download?from=collection&payment_id=4263159271&sig=355e9edee0759a592b9fc081e2ab92ce&sitem_id=34588382",
  "https://bandcamp.com/download?from=collection&payment_id=122455629&sig=23aa2c351808d9ce09413c20aeef59b0&sitem_id=34015347",
  "https://bandcamp.com/download?from=collection&payment_id=122455629&sig=23aa2c351808d9ce09413c20aeef59b0&sitem_id=34015348",
  "https://bandcamp.com/download?from=collection&payment_id=122455629&sig=23aa2c351808d9ce09413c20aeef59b0&sitem_id=34015349",
  "https://bandcamp.com/download?from=collection&payment_id=122455629&sig=23aa2c351808d9ce09413c20aeef59b0&sitem_id=34015350",
  "https://bandcamp.com/download?from=collection&payment_id=122455629&sig=23aa2c351808d9ce09413c20aeef59b0&sitem_id=34015351",
  "https://bandcamp.com/download?from=collection&payment_id=122455629&sig=23aa2c351808d9ce09413c20aeef59b0&sitem_id=34015352",
  "https://bandcamp.com/download?from=collection&payment_id=122455629&sig=23aa2c351808d9ce09413c20aeef59b0&sitem_id=34015353",
  "https://bandcamp.com/download?from=collection&payment_id=122455629&sig=23aa2c351808d9ce09413c20aeef59b0&sitem_id=34015354",
  "https://bandcamp.com/download?from=collection&payment_id=315951455&sig=4cfe62f491f18d460e51096d41d916f7&sitem_id=31829487",
  "https://bandcamp.com/download?from=collection&payment_id=1343904571&sig=5ef4396bf3ba1df396252e6bd4fbde83&sitem_id=31829465",
  "https://bandcamp.com/download?from=collection&payment_id=2367486355&sig=630c3b1803bf9a295e42e194c27f4eac&sitem_id=31210383",
  "https://bandcamp.com/download?from=collection&payment_id=2782092864&sig=b8938dc48a99e1c86d8033b074b62a93&sitem_id=29924418",
  "https://bandcamp.com/download?from=collection&payment_id=919304411&sig=112a65a0d9f9849ef75863012a915063&sitem_id=29500801",
  "https://bandcamp.com/download?from=collection&payment_id=2854930869&sig=7fce8f3307151b9ca1b95bbe0d72ec16&sitem_id=29500772",
  "https://bandcamp.com/download?from=collection&payment_id=1528356470&sig=91a32d210a6eb99c93b77a98e2fded20&sitem_id=29500768",
  "https://bandcamp.com/download?from=collection&payment_id=1147785585&sig=275b8e9bae2b1fb380b08a8bbae38be8&sitem_id=29499715",
  "https://bandcamp.com/download?from=collection&payment_id=758416865&sig=b0ad2cddfb51e2b9307e81ce19bfe06d&sitem_id=28973722",
  "https://bandcamp.com/download?from=collection&payment_id=2897131401&sig=14cf22fcdb6033a28e7bc35ca88eb3bb&sitem_id=28603690",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722168",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722170",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722175",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722182",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722186",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722203",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722204",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722228",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722231",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722233",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722237",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722251",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722257",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722261",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722268",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722273",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722308",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722310",
  "https://bandcamp.com/download?from=collection&payment_id=2839099176&sig=82c62e34a66d682592352f1b66a16dbb&sitem_id=24910740",
  "https://bandcamp.com/download?from=collection&payment_id=1628736803&sig=ee865d7c1151bc38a33bf90fa1d9f9cc&sitem_id=23369377",
  "https://bandcamp.com/download?from=collection&payment_id=2353399713&sig=5ce1ae5a7b3fc3d6ba622ffa2447c32c&sitem_id=23369356",
  "https://bandcamp.com/download?from=collection&payment_id=3949617321&sig=7663b42b016e0f3507070f012dfb4392&sitem_id=23095829",
  "https://bandcamp.com/download?from=collection&payment_id=2695853770&sig=39b00590b6fdd5f1a84dbb30a1d50691&sitem_id=23064157",
  "https://bandcamp.com/download?from=collection&payment_id=803341123&sig=0ea92480d22166c9fd67789c8f92a075&sitem_id=22216646",
  "https://bandcamp.com/download?from=collection&payment_id=1312576538&sig=8a3e222339c76cf3040b8979940e4bbe&sitem_id=21884985",
  "https://bandcamp.com/download?from=collection&payment_id=3980674548&sig=39fe0a8a0d7aa827955b62f12703d8ae&sitem_id=21634443",
  "https://bandcamp.com/download?from=collection&payment_id=3760790068&sig=12698ecd12f7f82be879365498ce8978&sitem_id=21456393",
  "https://bandcamp.com/download?from=collection&payment_id=2475788219&sig=c22923cff1c214415e55f333eacd507f&sitem_id=19223366",
  "https://bandcamp.com/download?from=collection&payment_id=3549018477&sig=fc68fd0c7b963b8abffd65c172e3fc7a&sitem_id=14567142",
  "https://bandcamp.com/download?from=collection&payment_id=2951065175&sig=bc65c7e3f491cff96ad17ead6dce6e52&sitem_id=12393345",
  "https://bandcamp.com/download?from=collection&payment_id=1814126675&sig=e199c9829771a4b8c584dcc56cab73b0&sitem_id=12393093",
  "https://bandcamp.com/download?from=collection&payment_id=223481183&sig=5db245f91401aa2d67b07df3f82570c4&sitem_id=11555224",
  "https://bandcamp.com/download?from=collection&payment_id=2504937651&sig=caaa939f3908d741854d6ae1daf63738&sitem_id=10747211",
  "https://bandcamp.com/download?from=collection&payment_id=374176318&sig=8853ebabc982a649aa4454cb6c24f823&sitem_id=10740841",
  "https://bandcamp.com/download?from=collection&payment_id=4076413668&sig=485113c0b10663a9a060b0d13aa11beb&sitem_id=9327321",
  "https://bandcamp.com/download?from=collection&payment_id=44847268&sig=5d45f1efcbb4e629f58dd2905762d483&sitem_id=9096998",
  "https://bandcamp.com/download?from=collection&payment_id=3673920326&sig=86eac4de181c5927bccbea93823d374e&sitem_id=6100718",
  "https://bandcamp.com/download?from=collection&payment_id=3726343981&sig=c15cbf086bf46b8d761fa7343e280830&sitem_id=5959936",
  "https://bandcamp.com/download?from=collection&payment_id=1695362138&sig=7a29b5219c04767598df3e46b47a7563&sitem_id=5733561",
  "https://bandcamp.com/download?from=collection&payment_id=511192253&sig=2e104a61949f40bf867a879b5ec584a4&sitem_id=5094705",
  "https://bandcamp.com/download?from=collection&payment_id=3371328325&sig=4a526ffea305b9bb66aae02611e58c89&sitem_id=4906636",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722371",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722367",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722372",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722366",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722363",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722364",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722365",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722368",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722362",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722358",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722156",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722157",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722158",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722159",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722160",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722161",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722162",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722163",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722164",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722165",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722166",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722167",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722169",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722171",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722172",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722173",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722174",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722176",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722177",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722178",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722179",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722180",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722181",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722183",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722184",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722185",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722187",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722188",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722189",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722190",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722191",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722192",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722193",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722194",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722195",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722196",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722197",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722198",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722199",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722200",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722201",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722202",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722205",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722206",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722207",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722208",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722209",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722210",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722211",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722212",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722213",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722214",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722215",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722216",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722217",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722218",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722219",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722220",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722221",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722222",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722223",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722224",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722225",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722226",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722227",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722229",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722230",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722232",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722234",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722235",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722236",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722238",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722239",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722240",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722241",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722242",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722243",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722244",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722246",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722247",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722248",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722249",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722250",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722252",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722253",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722254",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722255",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722256",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722258",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722259",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722260",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722262",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722263",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722264",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722265",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722267",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722270",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722271",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722274",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722276",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722277",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722278",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722279",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722280",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722281",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722282",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722283",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722284",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722286",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722288",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722290",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722293",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722294",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722295",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722297",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722300",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722301",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722304",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722305",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722309",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722311",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722312",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722313",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722314",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722315",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722316",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722317",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722319",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722321",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722324",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722326",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722329",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722330",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722331",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722334",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722336",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722339",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722341",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722343",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722346",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722348",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722351",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722353",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722355",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722359",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722370",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722360",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722369",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722245",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722266",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722269",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722272",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722275",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722285",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722287",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722289",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722291",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722292",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722296",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722298",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722299",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722302",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722303",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722306",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722307",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722318",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722320",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722322",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722323",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722325",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722327",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722328",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722332",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722333",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722335",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722337",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722338",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722340",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722342",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722344",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722345",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722347",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722349",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722350",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722352",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722354",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722356",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722357",
  "https://bandcamp.com/download?from=collection&payment_id=597260334&sig=73241e9ea2a3a227776b7e0d59cba8bc&sitem_id=27722361",
  "https://bandcamp.com/download?from=collection&payment_id=3582417980&sig=5b098a4492b87283f906c9e79bc90c1b&sitem_id=5121168"
]


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
  /*
  .wait('#collection-container')
  .use(nightmare => nightmare.evaluate(selector => {
    const links = document.querySelectorAll(selector)
    return Array.prototype.map.call(links, link => link.href)
  }, downloadItemLinkSelectors)) */
  .end()
  .then(() => {
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

const p = () => nb

const downloadAlbum = url => getAlbumDownloadLink(url)
  .then(downloadBandcampZip)
  .then(unzipMusic)
  .catch(err => {
    console.error('watafuck!')
    console.error(err)
  })

const rename = promisify(fs.rename)
const unzipMusic = zipResult => {
  const target = path.join(options.unzipDestination, zipResult.musicName)
  if (!/zip$/.test(target)) {
    return rename(zipResult.zipPath, target)
      .then(() => console.log(`Moving ${target} done!`))
  }
  return mkdirpAsync(target)
    .then(() => unzipAsync(zipResult.zipPath, { target, fix: true }))
    .then(() => console.log(`Unzipping ${target} done!`))
}

const getAlbumDownloadLink = url => new Nightmare(options)
  .useragent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.110 Safari/537.36")
  .goto(url)
  .wait(query => {
    const el = document.querySelector(query)
    if (!el) return true
    return (el.style.display === 'none')
  }, downloadButtonSelector)
  .wait(1000)
  .evaluate(query => document.querySelector(query).href, downloadButtonSelector)
  .end()

const downloadBandcampZip = musicLink => new Promise((s, f) => {
  let musicName = `download-${musicLink.split(/item_id=([0-9]+)/)[1]}.zip`
  const downloadFileName = path.join(TEMP_DIR, musicName)
  const progressStream = progress({time: 1000})
    .on('progress', progress => console.log(`downloaded ${Math.round(progress.percentage)}% of ${musicLink}`))
    .on('finish', () => {
      const zipPath = path.join(options.zipDestination, musicName)
      fs.rename(downloadFileName, zipPath, err => err
        ? f(err)
        : s({ musicName, zipPath }))
    })

  request
    .get(musicLink)
    .on('error', f)
    .on('response', response => {
      progressStream.setLength(response.headers['content-length'])
      const contentDisposition = response.headers['content-disposition']
      console.log(`Downloading zip file ${filesize(response.headers['content-length'])}`)

      if (contentDisposition !== undefined) {
        const fileNameMatch = contentDisposition.split(/filename\*=UTF-8''(.*\.(:?zip|ogg))/)
        if (!fileNameMatch[1]) {
          return console.error('unable to determine filename from the response headers')
        }
        musicName = `${decodeURIComponent(fileNameMatch[1])}`
      }
    })
    .pipe(progressStream)
    .pipe(fs.createWriteStream(downloadFileName))
})
