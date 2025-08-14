// 全局音乐管理器
// 这个脚本将被包含在所有需要音乐功能的页面中

class MusicManager {
    constructor() {
        this.audio = null;
        this.currentFile = null;
        this.isPlaying = false;
        this.isLoaded = false;
        
        this.setupEventListeners();
        this.initializeFromStore();
    }
    
    setupEventListeners() {
        // 监听主进程的音乐播放请求
        if (typeof ipc !== 'undefined') {
            ipc.on('music-play-request', (event, data) => {
                this.loadAndPlay(data.filePath);
            });
            
            ipc.on('music-pause-request', () => {
                this.pause();
            });
            
            ipc.on('music-stop-request', () => {
                this.stop();
            });

            // 监听恢复音乐状态的请求
            ipc.on('music-restore-state', (event, data) => {
                this.restoreState(data);
            });
        }
    }
    
    // 从存储中初始化音乐状态
    initializeFromStore() {
        if (typeof ipc !== 'undefined') {
            // 请求主进程提供当前音乐状态
            ipc.send('music-get-current-state');
        }
    }

    // 恢复音乐状态
    restoreState(state) {
        if (state.filePath && state.isPlaying) {
            // 如果音乐应该正在播放，恢复播放状态
            this.loadAndPlay(state.filePath, false); // false 表示不要通知主进程状态变化
        } else if (state.filePath) {
            // 如果有音乐文件但不在播放，只加载不播放
            this.loadFile(state.filePath);
        }
    }

    loadFile(filePath) {
        try {
            if (this.audio) {
                this.audio.pause();
                this.audio = null;
            }
            
            this.audio = new Audio();
            this.audio.src = 'file://' + filePath;
            this.audio.loop = true;
            this.currentFile = filePath;
            
            this.audio.addEventListener('loadeddata', () => {
                this.isLoaded = true;
            });
            
            this.audio.addEventListener('error', (e) => {
                console.error('Audio loading error:', e);
                this.isLoaded = false;
            });
            
            this.audio.load();
        } catch (error) {
            console.error('Load file error:', error);
        }
    }
    
    loadAndPlay(filePath, notifyMainProcess = true) {
        try {
            if (this.audio && this.currentFile === filePath && this.isLoaded) {
                // 如果是相同文件且已加载，直接播放
                this.play(notifyMainProcess);
                return;
            }

            if (this.audio) {
                this.audio.pause();
                this.audio = null;
            }
            
            this.audio = new Audio();
            this.audio.src = 'file://' + filePath;
            this.audio.loop = true;
            this.currentFile = filePath;
            
            this.audio.addEventListener('loadeddata', () => {
                this.isLoaded = true;
                this.play(notifyMainProcess);
            });
            
            this.audio.addEventListener('error', (e) => {
                console.error('Audio loading error:', e);
                this.isLoaded = false;
                if (notifyMainProcess && typeof ipc !== 'undefined') {
                    ipc.send('music-play-failed');
                }
            });
            
            this.audio.load();
        } catch (error) {
            console.error('Load and play error:', error);
            if (notifyMainProcess && typeof ipc !== 'undefined') {
                ipc.send('music-play-failed');
            }
        }
    }
    
    play(notifyMainProcess = true) {
        if (this.audio && this.isLoaded) {
            this.audio.play().then(() => {
                this.isPlaying = true;
                if (notifyMainProcess && typeof ipc !== 'undefined') {
                    ipc.send('music-play-success-from-renderer');
                }
            }).catch(error => {
                console.error('Play error:', error);
                if (notifyMainProcess && typeof ipc !== 'undefined') {
                    ipc.send('music-play-failed');
                }
            });
        }
    }
    
    pause(notifyMainProcess = true) {
        if (this.audio) {
            this.audio.pause();
            this.isPlaying = false;
            if (notifyMainProcess && typeof ipc !== 'undefined') {
                ipc.send('music-pause-success-from-renderer');
            }
        }
    }
    
    stop(notifyMainProcess = true) {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.isPlaying = false;
            if (notifyMainProcess && typeof ipc !== 'undefined') {
                ipc.send('music-stop-success-from-renderer');
            }
        }
    }
    
    getStatus() {
        return {
            isLoaded: this.isLoaded,
            isPlaying: this.isPlaying,
            currentFile: this.currentFile
        };
    }
}

// 创建全局音乐管理器实例
if (typeof window !== 'undefined') {
    window.musicManager = new MusicManager();
}
