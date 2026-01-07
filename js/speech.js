/**
 * 音声合成モジュール
 */
const Speech = {
  /** @type {SpeechSynthesisVoice|null} */
  _voice: null,

  /** @type {boolean} */
  _initialized: false,

  /**
   * 音声合成を初期化
   * @returns {Promise<boolean>}
   */
  async init() {
    if (!('speechSynthesis' in window)) {
      console.error(CONSTANTS.ERROR_MESSAGES.NO_SPEECH);
      return false;
    }

    // 音声リストが読み込まれるまで待機
    return new Promise((resolve) => {
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        // 日本語音声を優先
        this._voice = voices.find(v => v.lang.startsWith('ja')) ||
                      voices.find(v => v.lang.startsWith('en')) ||
                      voices[0] ||
                      null;
        this._initialized = true;
        resolve(!!this._voice);
      };

      if (speechSynthesis.getVoices().length > 0) {
        loadVoices();
      } else {
        speechSynthesis.addEventListener('voiceschanged', loadVoices, { once: true });
        // タイムアウト（一部ブラウザでvoiceschangedが発火しない場合）
        setTimeout(() => {
          if (!this._initialized) {
            loadVoices();
          }
        }, 1000);
      }
    });
  },

  /**
   * Claude APIキーを設定（後方互換性のため維持、未使用）
   * @param {string|null} apiKey - 未使用
   */
  setClaudeApiKey(apiKey) {
    // 未使用（後方互換性のため関数は残す）
  },

  /**
   * テキストを音声で発話
   * @param {string} text
   * @returns {Promise<void>}
   */
  speak(text) {
    return new Promise((resolve, reject) => {
      if (!this._initialized) {
        reject(new Error('音声合成が初期化されていません'));
        return;
      }

      // 既存の発話をキャンセル
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      if (this._voice) {
        utterance.voice = this._voice;
      }
      utterance.lang = 'ja-JP';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(e);

      speechSynthesis.speak(utterance);
    });
  },

  /**
   * リマインドメッセージを生成
   * @param {string} boardName - ボード名（案件名）
   * @param {string} taskName - タスク名
   * @param {string} priority - 優先度（critical/high）
   * @param {boolean} isOverdue - 期限切れかどうか
   * @returns {string}
   */
  _generateMessage(boardName, taskName, priority, isOverdue = false) {
    const prefix = boardName ? `${boardName}の` : '';
    const deadline = isOverdue ? '期限切れです！' : '今日が期限です。';
    return `${prefix}${taskName}、${deadline}`;
  },

  /**
   * タスクをリマインドフレーズで発話
   * @param {{name: string, boardName: string, priority: string, isOverdue: boolean}} task
   */
  async remind(task) {
    const message = this._generateMessage(
      task.boardName || '',
      task.name,
      task.priority || 'high',
      task.isOverdue || false
    );
    await this.speak(message);
  },

  /**
   * 複数タスクをリマインド
   * @param {Array<{name: string, boardName: string, priority: string}>} tasks
   */
  async remindTasks(tasks) {
    for (const task of tasks) {
      await this.remind(task);
      // タスク間に少し間隔を空ける
      await new Promise(r => setTimeout(r, 500));
    }
  },

  /**
   * テスト発話
   */
  async test() {
    const message = this._generateMessage(
      'テスト案件',
      'テストタスク',
      'critical',
      false
    );
    await this.speak(message);
  }
};
