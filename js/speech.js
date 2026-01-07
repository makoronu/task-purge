/**
 * 音声合成（バックエンドAPI経由でClaude AI連携）
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
   * Claude APIキーを設定（後方互換性のため維持、サーバー側で管理）
   * @param {string|null} apiKey - 未使用
   */
  setClaudeApiKey(apiKey) {
    // APIキーはサーバー側環境変数で管理するため、この関数は何もしない
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
   * バックエンドAPI経由でClaude AIメッセージを生成
   * @param {string} boardName - ボード名（案件名）
   * @param {string} taskName - タスク名
   * @param {string} priority - 優先度（critical/high）
   * @param {boolean} isOverdue - 期限切れかどうか
   * @returns {Promise<string>}
   */
  async _generateMessage(boardName, taskName, priority, isOverdue = false) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONSTANTS.CLAUDE_TIMEOUT_MS);

    try {
      const response = await fetch(CONSTANTS.CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          boardName: boardName || '不明な案件',
          taskName,
          priority: priority || 'high',
          isOverdue: isOverdue || false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (data?.message) {
        return data.message;
      }

      return this._getFallbackMessage(taskName, isOverdue, boardName);
    } catch (error) {
      clearTimeout(timeoutId);
      // エラー時は静的フレーズにfallback
      return this._getFallbackMessage(taskName, isOverdue, boardName);
    }
  },

  /**
   * 静的フレーズを取得（fallback用）
   * @param {string} taskName
   * @param {boolean} isOverdue
   * @param {string} boardName
   * @returns {string}
   */
  _getFallbackMessage(taskName, isOverdue = false, boardName = '') {
    const prefix = boardName ? `${boardName}の` : '';
    const deadline = isOverdue ? '期限切れです！' : '今日が期限です。';
    return `${prefix}${taskName}、${deadline}`;
  },

  /**
   * タスクをリマインドフレーズで発話
   * @param {{name: string, boardName: string, priority: string, isOverdue: boolean}} task
   */
  async remind(task) {
    const message = await this._generateMessage(
      task.boardName || '不明な案件',
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
   * テスト発話（AI生成メッセージでテスト）
   */
  async test() {
    const testMessage = await this._generateMessage(
      'テスト案件',
      'テストタスク',
      'critical'
    );
    await this.speak(testMessage);
  }
};
