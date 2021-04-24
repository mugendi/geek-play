const PassThrough = require('stream').PassThrough;
const getInfo = require('./info');
// const utils = require('./utils');
const formatUtils = require('./format-utils');
const urlUtils = require('./url-utils');
const sig = require('./sig');
const m3u8stream = require('m3u8stream');
const { parseTimestamp } = require('m3u8stream');


/**
 * @param {string} link
 * @param {!Object} options
 * @returns {ReadableStream}
 */
const ytdl = (link, options) => {
    // const stream = createStream(options);
    ytdl.getInfo(link, options);
    return stream;
};
module.exports = ytdl;

ytdl.getBasicInfo = getInfo.getBasicInfo;
ytdl.getInfo = getInfo.getInfo;
// ytdl.chooseFormat = formatUtils.chooseFormat;
// ytdl.filterFormats = formatUtils.filterFormats;
// ytdl.validateID = urlUtils.validateID;
// ytdl.validateURL = urlUtils.validateURL;
// ytdl.getURLVideoID = urlUtils.getURLVideoID;
// ytdl.getVideoID = urlUtils.getVideoID;
ytdl.cache = {
    sig: sig.cache,
    info: getInfo.cache,
    watch: getInfo.watchPageCache,
    cookie: getInfo.cookieCache,
};