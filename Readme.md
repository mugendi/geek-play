
```
    ____           _    ____  _
   / ___| ___  ___| | _|  _ \| | __ _ _   _
  | |  _ / _ \/ _ \ |/ / |_) | |/ _` | | | |
  | |_| |  __/  __/   <|  __/| | (_| | |_| |
   \____|\___|\___|_|\_\_|   |_|\__,_|\__, |
                                      |___/  because Geeks ❤ good music!

```


# What is Geek Player
This is a simple CLI player that does simple thing, and some complex things that music players should do while getting out of your way so you can enjoy writing your code!

**Not a geek?** *Become one :-)*

## You will need NodeJs. Who doesn't?
You may not be a NodeJs developer but you certainly might have encountered it while packaging your Javascript resources or generating css from Sass. Right?

If not, then here is your opportunity, because Geek Player is a NodeJs Module.

## What else do you need?
Essentially the player uses *FFMPEG's*, *FFPLAY* to play/stream audio. So if you have that installed, that's awesome. If not, the a version compatible with your system (Windows, MacOS or Linux) will be automatically downloaded and used.

## Getting started
Install **GeekPlay** globally with ```npm install -g geekplay```.

**NOTE:** I have heard that complaints that there are issues installing this with  ```yarn add --global```. So please use ```npm``` for now.

## Playing your music

To play your music, simply send the command: ```GeekPlay edm``` if you love EDM music like I do.

![Sample Animation](https://github.com/mugendi/geek-play/raw/master/docs/assets/animation.gif)

Under the hood, **GeekPlay** will search YouTube for "EDM" or whatever other term you give it and start streaming those tracks as audio in your CLI.

For advanced usage, please read the [Player Documentation](./docs/player.md).



## Contributing
Please share your views and report any bugs you might come across. And enjoy the music!

*Special thanks to [Joseph](https://github.com/joseph-n) who tried out the very first tests of this player [YT-VLC](https://www.npmjs.com/package/yt-vlc) immediately saw the potential and challenged me to go the whole way.*