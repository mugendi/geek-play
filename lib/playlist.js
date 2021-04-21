/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/

const fs = require('fs-extra'),
    m3uWriter = require('m3u').extendedWriter(),
    { duration_to_s } = require("./common"),
    filenamify = require('filenamify'),
    kebabCase = require('lodash/kebabCase'),
    camelCase = require('lodash/camelCase'),
    tildify = require('tildify'),
    path = require('path'),
    arrify = require('arrify')


class Playlist {
    constructor(opts) {
        let self = this;

        for (let k in opts) {
            self[k] = opts[k];
        }

        // ensure playlist directory or throw
        if (this.settings.storage.playlist) {
            this.playlistDir = path.normalize(this.settings.storage.playlist)
            fs.ensureDir(this.playlistDir)
                .catch(function(err) {
                    throw err;
                })
        } else {
            // 
            throw new Error(`Playlist path not set! Run "geekplay --setting storage"!`)
        }




    }

    playlistFile() {

        let fileName, filePath;

        // if user has entered a name
        if (this.flags.plName) {
            fileName = kebabCase(this.flags.plName);
        } else {
            fileName = kebabCase(this.input);
        }


        fileName = filenamify(camelCase(this.mediaType + '-' + this.action) + '~' + fileName) + '.m3u';

        filePath = path.join(this.playlistDir, fileName)

        // console.log(this);
        return filePath;

    }

    save(videos, appendMode = false) {
        // console.log(videos);
        let num = 0;

        // let us get a name for the playlist
        let playlistFile = this.playlistFile(),
            playlistFiles = [];

        // ensure unique if the playlist already exists 
        if (fs.existsSync(playlistFile)) {
            // read current playlist
            let content = fs.readFileSync(playlistFile, 'utf8');
            // make an array of all the links
            playlistFiles = [...content.matchAll(/https?:[^\r\n]+/g)].map(a => a[0]);
        }


        for (let video of arrify(videos)) {

            if (playlistFiles.indexOf(video.url) == -1) {

                num++;
                // 
                if (video) {
                    // Video Object
                    video = Object.assign({ title: "Unknown Title", artist: "Unknown Artist", duration: 0 }, video);

                    // duration = typeof video.duration == 'number' ? video.duration : duration_to_seconds(video.duration || '0');
                    // Add comment
                    m3uWriter.comment(`[${num}] - ${video.title} by ${video.artist|| "*"} - ${video.duration}`);
                    // A playlist item, usually a path or url.
                    m3uWriter.file(video.url, duration_to_s(video.duration), video.title);
                    // An empty line.
                    m3uWriter.write();
                }

                // break
            }
        }

        // if we have files to save...
        if (num) {

            let m3uPlaylistContent = m3uWriter.toString();

            // do we want to update playlist
            if (appendMode || (this.settings.addToPlaylist && fs.existsSync(playlistFile))) {
                console.log(`Adding ${num} tracks to playlist: ${tildify(playlistFile)}`);
                // file exists so append
                fs.appendFile(playlistFile, m3uPlaylistContent);
            } else {
                console.log(`Saving ${num} tracks to playlist: ${tildify(playlistFile)}`);
                // create file
                fs.writeFileSync(playlistFile, m3uPlaylistContent);
            }

        } else {
            console.log(`No new files to add to save to playlist: ${tildify(playlistFile)}`);
        }
    }


}


module.exports = (opts) => new Playlist(opts)