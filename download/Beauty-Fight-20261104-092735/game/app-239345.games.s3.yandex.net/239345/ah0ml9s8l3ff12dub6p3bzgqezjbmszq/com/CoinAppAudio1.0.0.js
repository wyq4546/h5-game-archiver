

! function () {

    class CoinAppAudioEngine {
        constructor() {
            this.beEnabled = false;
            this.isMuted = false;
            this.bePauseSound = false;
            this.bePauseMusic = false;
            this.tryToResumeIntervalId = -1;
            this.isVisibilityMuted = false;
            this.adShowing = false;
        }

        /**进入游戏时调用，需要把游戏播放声音的地方都注释，全部改用这边的方法*/
        onStart(cb) {
            window.document.addEventListener("visibilitychange", () => {
                if (document.visibilityState == "hidden") {
                    window.visibleTimer && clearTimeout(window.visibleTimer);
                    window.CoinAppAudio.noVisibleCallBack();
                    window.CoinAppAudio.stopAll();

                } else if (document.visibilityState == "visible") {

                    window.CoinAppAudio.visibleCallBack();
                    window.CoinAppAudio.stopAll();
                    window.visibleTimer = setTimeout(() => {
                        window.CoinAppAudio.stopAll();
                        window.CoinAppAudio.init().then(() => {
                            window.CoinAppAudio.playCoinAppMusic();
                            
                        })
                    }, 1000);
                }
            });

            window.CoinAppAudio.init().then(() => {
                // window.CoinAppAudio.playCoinAppMusic();
                cb && cb();
            })
        }

        /**
         * @description 界面隐藏回调 游戏自行修改
         */
        noVisibleCallBack() {
            if (window.Laya) {
                Laya.timer.scale = 0;//时间暂停
                Laya.stage.renderingEnabled = false //停止渲染
                Laya.updateTimer && Laya.updateTimer.pause() //停止onUpdate
                Laya.physicsTimer && Laya.physicsTimer.pause() //停止物理
            }
        }
        /**
        * @description 界面显示回调 游戏自行修改
        */
        visibleCallBack() {
            if (window.Laya) {
                window.focus(); //找回焦点
                Laya.timer.scale = 1;//时间恢复
                Laya.stage.renderingEnabled = true //恢复渲染
                Laya.updateTimer && Laya.updateTimer.resume() //恢复onUpdate
                Laya.physicsTimer && Laya.physicsTimer.resume() //恢复物理
            }
        }

       /**根据游戏自行修改*/
       async playCoinAppMusic() {
        //是否静音
        if (VkApp.isSoundMute || !window.isOpenMusic || window.isVideo) {
            return
        }
        this.playMusic(CoinAppAudio.bgm);
    }
    /**游戏内调用*/
    async playSound(url, loop = false, singleton = false) {
        if (VkApp.isSoundMute || !window.isOpenMusic || window.isVideo) {
            return
        }
        this.soundAudio.play(url, loop, singleton);
    }


        /**游戏内调用*/
        playMusic(url) {
            if (!url) {
                return;
            }
            if (!this.musicAudio) {
                return;
            }
            this.musicAudio.stopAll();

            if (VkApp.isSoundMute || !window.isOpenMusic || window.isVideo) {
                return;
            }
            this.musicAudio.playMusic(url);
        }

        /**游戏内调用*/
        stopAll() {
            this.musicAudio && this.musicAudio.stopAll();
            this.soundAudio && this.soundAudio.stopAll();
        }

        /**游戏内调用*/
        stopMusic() {
            this.musicAudio && this.musicAudio.stopAll();
        }

        /**游戏内调用*/
        stopSound(url) {
            this.soundAudio && this.soundAudio.stop(url);
        }


        /**下面的方法没啥事不用改*/
        init() {
            return new Promise((resolve, reject) => {
                try {
                    this.stopAll();

                    this.musicAudio = new WebAudioContext();
                    this.soundAudio = new WebAudioContext();

                    // window.document.addEventListener("mousedown", this.tryToResumeAudioContext.bind(this),
                    //     true);
                    // window.document.addEventListener("touchstart", this.tryToResumeAudioContext.bind(this),
                    //     true);
                    // window.document.addEventListener("visibilitychange", this.onVisibilitychange.bind(
                    //     this));
                    // this.tryToResumeIntervalId = setInterval(this.tryToResumeAudioContext.bind(this),
                    //     0.2e3);
                    // this.musicAudio.getContext().onstatechange = this.onMusicStatechange.bind(this);
                    // this.soundAudio.getContext().onstatechange = this.onSoundStatechange.bind(this);
                    this.beEnabled = true;
                    this.musicVolume = 100;
                    resolve(true);
                } catch (e) {
                    console.log("Web Audio API", e);
                    alert("Web Audio API is not supported in this browser");
                    resolve(false);
                }
            });
        }
        onVisibilitychange() {
            return;
            // if (window.CoinAppAudio.adShowing) {
            //     return;
            // }
            if (document.visibilityState == "hidden") {

                // if (!this.isMuted) {
                //     this.isVisibilityMuted = this.muted = true;
                // }
                // Laya.timer.scale = 0;
                // Laya.stage.renderingEnabled = false //停止渲染
                // Laya.updateTimer && Laya.updateTimer.pause() //停止onUpdate
                // Laya.physicsTimer && Laya.physicsTimer.pause() //停止物理


                this.musicAudio.suspend();

                this.soundAudio.suspend();
            } else if (document.visibilityState == "visible") {
                // if (this.isVisibilityMuted) {
                //     this.isVisibilityMuted = this.muted = false;
                // }
                // Laya.timer.scale = 1;
                // Laya.stage.renderingEnabled = true //恢复渲染
                // Laya.updateTimer && Laya.updateTimer.resume() //恢复onUpdate
                // Laya.physicsTimer && Laya.physicsTimer.resume() //恢复物理


                this.musicAudio.resume();

                this.soundAudio.resume();

                setTimeout(() => {
                    this.musicAudio.musicVolume(100);
                    window.CoinAppAudio.playMusic("music/audio_bgm01.mp3");
                }, 1000);


            }
        }
        onDBInstanceMuted() {
            // this.pauseMusic = DBInstance$1.musicMuted.value;
            // this.pauseSound = DBInstance$1.soundMuted.value;
        }
        tryToResumeAudioContext() {
            // if (this.isMuted)
            //     return;

            // if (this.musicAudio.isSuspend() && !this.bePauseMusic) {
            //     this.musicAudio.resume();
            // }
            // if (this.soundAudio.isSuspend() && !this.bePauseSound) {
            //     this.soundAudio.resume();
            // }
            // if (!this.musicAudio.isSuspend() || !this.soundAudio.isSuspend()) {
            //     window.document.removeEventListener("mousedown", this.tryToResumeAudioContext.bind(this), true);
            //     window.document.removeEventListener("touchstart", this.tryToResumeAudioContext.bind(this), true);
            //     clearInterval(this.tryToResumeIntervalId);
            //     this.tryToResumeIntervalId = -1;
            // }
        }
        onMusicStatechange() {
            if (this.musicAudio.isSuspend() && !this.isMuted && !this.bePauseMusic && this.tryToResumeIntervalId ===
                -1) {
                window.document.addEventListener("mousedown", this.tryToResumeAudioContext.bind(this), true);
                window.document.addEventListener("touchstart", this.tryToResumeAudioContext.bind(this), true);
                this.tryToResumeIntervalId = setInterval(this.tryToResumeAudioContext.bind(this), 0.2e3);
            }
        }
        onSoundStatechange() {
            if (this.soundAudio.isSuspend() && !this.isMuted && !this.bePauseSound && this.tryToResumeIntervalId ===
                -1) {
                window.document.addEventListener("mousedown", this.tryToResumeAudioContext.bind(this), true);
                window.document.addEventListener("touchstart", this.tryToResumeAudioContext.bind(this), true);
                this.tryToResumeIntervalId = setInterval(this.tryToResumeAudioContext.bind(this), 0.2e3);
            }
        }
        set muted(b) {
            this.isMuted = b;
            if (this.isMuted) {
                this.musicAudio.suspend();
                this.soundAudio.suspend();
            } else {
                if (this.tryToResumeIntervalId == -1) {
                    this.tryToResumeIntervalId = setInterval(this.tryToResumeAudioContext.bind(this), 0.2e3);
                }

            }
        }

        get muted() {
            return this.isMuted;
        }

        set pause(b) {
            this.pauseSound = b;
            this.pauseMusic = b;
            if (!b) {
                this.soundAudio.stopAllNoLoop();
            }
        }
        get pause() {
            return this.pauseSound || this.pauseMusic;
        }

        set pauseSound(b) {
            this.bePauseSound = b;
            if (this.bePauseSound) {
                this.soundAudio.suspend();
            } else {
                if (this.isMuted)
                    return;
                this.soundAudio.resume();
            }
        }
        get pauseSound() {
            return this.bePauseSound;
        }
        get pauseMusic() {
            return this.bePauseMusic;
        }
        set pauseMusic(b) {
            this.bePauseMusic = b;
            if (this.bePauseMusic) {
                this.musicAudio.suspend();
            } else {
                if (this.isMuted)
                    return;
                this.musicAudio.resume();
            }
        }

        parse(url, data, onComplete) {
            this.soundAudio.parse(url, data);
        }


        set musicVolume(vlaue) {
            this.musicAudio.musicVolume = vlaue;
        }
        get musicVolume() {
            return this.musicAudio.musicVolume;
        }


    }
    class WebAudioSource { }
    class WebAudioContext {
        constructor() {
            this.volume = 100;
            this._audioInstances = new Map();
            this._musicVolume = 100;
            window.AudioContext = window.AudioContext || window["webkitAudioContext"];
            this.context = new AudioContext();
        }
        getContext() {
            return this.context;
        }
        isSuspend() {
            return this.context.state === "suspended";
        }
        suspend() {
            this.context.suspend();
        }
        resume() {
            this.context.resume();
        }
        stopAllNoLoop() {
            const values = this._audioInstances.values();
            for (const sound of values) {
                const instance = sound.instance;
                if (instance.source.buffer && !instance.source.loop) {
                    try {
                        instance.source.stop(this.context.currentTime);
                    } catch (e) {
                        instance.source.disconnect();
                    }
                    instance.source.onended = (function () { });
                    instance.setup();
                }
            }
        }
        stopAll() {
            const values = this._audioInstances.values();
            for (const sound of values) {
                const instance = sound.instance;
                if (instance.source.buffer) {
                    try {
                        instance.source.stop(this.context.currentTime);
                    } catch (e) {
                        instance.source.disconnect();
                    }
                    instance.source.onended = (function () { });
                    instance.setup();
                }
            }
        }
        stop(url) {
            if (this._audioInstances.has(url)) {
                const sound = this._audioInstances.get(url);
                this._stopSound(sound);
            }
        }
        _stopSound(sound) {
            const instance = sound.instance;
            if (instance.source.buffer) {
                try {
                    instance.source.stop(this.context.currentTime);
                } catch (e) {
                    instance.source.disconnect();
                }
                instance.source.onended = (function () { });
                instance.setup();
            }
        }
        playMusic(url) {
            if (this._music) {
                this._stopSound(this._music);
            }
            if (this._audioInstances.has(url)) {
                this._music = this._audioInstances.get(url);
                this.musicVolume = this._musicVolume;
                this.play(url, true);
            } else {
                this.downloadArrayBuffer(url, () => {
                    this.playMusic(url);
                });
            }
        }
        stopMusic() {
            if (this._music) {
                this._stopSound(this._music);
            }
        }
        set musicVolume(vlaue) {
            this._musicVolume = vlaue;
            if (this._music) {
                this._music.instance.gain.gain.value = this._musicVolume / 100;
            }
        }
        get musicVolume() {
            return this._musicVolume;
        }
        play(url, loop = false, singleton = false) {
            if (this._audioInstances.has(url)) {
                const sound = this._audioInstances.get(url);
                const instance = sound.instance;
                if (singleton && !instance.ended)
                    return;
                this.stop(url);
                if (sound.buffer) {
                    try {
                        if (window.CoinAppAudio.pause && !loop) {
                            return;
                        }
                        instance.playBuffer(this.context.currentTime, sound.buffer);
                        instance.source.loop = loop;
                    } catch (e) {
                        console.error("playBuffer error. Exception: " + e);
                    }
                }
            } else {
                this.downloadArrayBuffer(url, () => {
                    this.play(url, loop);
                });
            }
        }
        load(urls, onComplete) {
            let t = urls.length;
            let d = 0;
            for (let i = 0; i < urls.length; i++) {
                const url = urls[i];
                this.downloadArrayBuffer(url, () => {
                    d++;
                    if (d >= t) {
                        onComplete && onComplete();
                    }
                });
            }
        }
        setThreeD(url) {
            if (this._audioInstances.has(url)) {
                const sound = this._audioInstances.get(url);
                sound.instance.threeD = true;
            }
        }
        createSoundInstance() {
            let audioContext = this.context;
            const instance = {
                gain: audioContext.createGain(),
                panner: audioContext.createPanner(),
                threeD: false,
                ended: false,
                playBuffer: (function (delay, buffer, offset) {
                    this.source.buffer = buffer;
                    var chan = this;
                    this.ended = false;
                    this.source.onended = (function () {
                        chan.setup();
                        chan.ended = true;
                    });
                    this.source.start(delay, offset);
                }),
                setup: (function () {
                    this.source = audioContext.createBufferSource();
                    this.setupPanning();
                }),
                setupPanning: (function () {
                    if (this.threeD) {
                        this.source.disconnect();
                        this.source.connect(this.panner);
                        this.panner.connect(this.gain);
                    } else {
                        this.panner.disconnect();
                        this.source.connect(this.gain);
                    }
                })
            };
            instance.panner.rolloffFactor = 0;
            instance.gain.connect(this.context.destination);
            instance.setup();
            return instance;
        }
        parse(url, data, onComplete) {
            const sound = new WebAudioSource();
            sound.url = url;
            sound.instance = this.createSoundInstance();
            this._audioInstances.set(url, sound);
            this.context.decodeAudioData(data, function (buffer) {
                sound.buffer = buffer;
                onComplete && onComplete();
            }, function (e) {
                sound.error = true;
                onComplete && onComplete();
                console.log("Decode error." + sound.url);
            });
        }
        downloadArrayBuffer(url, onComplete) {
            if (this._audioInstances.has(url)) {
                onComplete && onComplete();
                return;
            }
            const t = this;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = function () {
                if (xhr.status === 200 || xhr.status === 0) {
                    t.parse(url, xhr.response, onComplete);
                } else {
                    throw "no response";
                }
            };
            xhr.onerror = function () {
                onComplete && onComplete();
                throw "no response";
            };
            xhr.ontimeout = function () {
                onComplete && onComplete();
            };
            xhr.onabort = function () {
                onComplete && onComplete();
            };
            xhr.send(null);
        }
    }

    window.CoinAppAudio = new CoinAppAudioEngine();

}()
