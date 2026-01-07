/**
 * 音声合成（Claude API統合版）
 */
const Speech = {
  /** @type {SpeechSynthesisVoice|null} */
  _voice: null,

  /** @type {boolean} */
  _initialized: false,

  /** @type {string|null} */
  _claudeApiKey: null,

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
   * Claude APIキーを設定
   * @param {string|null} apiKey
   */
  setClaudeApiKey(apiKey) {
    this._claudeApiKey = apiKey || null;
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
   * Claude APIで有機的なメッセージを生成
   * @param {string} boardName - ボード名（案件名）
   * @param {string} taskName - タスク名
   * @param {string} priority - 優先度（critical/high）
   * @param {boolean} isOverdue - 期限切れかどうか
   * @returns {Promise<string>}
   */
  async _generateMessage(boardName, taskName, priority, isOverdue = false) {
    if (!this._claudeApiKey) {
      return this._getFallbackMessage(taskName, isOverdue, boardName);
    }

    const priorityText = priority === 'critical' ? '緊急' : '高優先度';
    const deadlineText = isOverdue ? '期限切れ（過ぎています！）' : '今日';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONSTANTS.CLAUDE_TIMEOUT_MS);

    try {
      const response = await fetch(CONSTANTS.CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this._claudeApiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: CONSTANTS.CLAUDE_MODEL,
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: `タスクリマインダーです。以下のタスクを緊急感を持って50文字以内で伝えてください。
面白く、でも失礼なく。語尾は「ですよ！」「ください！」など。
${isOverdue ? '【重要】期限切れなので特に急いでいることを強調してください。' : ''}

ボード名（案件）: ${boardName}
タスク名: ${taskName}
優先度: ${priorityText}
期限: ${deadlineText}

メッセージのみを出力してください。`
          }]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const message = data?.content?.[0]?.text;

      if (message) {
        return message.trim();
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
   * テスト発話
   */
  async test() {
    if (this._claudeApiKey) {
      // Claude APIが設定されている場合はAI生成メッセージでテスト
      const testMessage = await this._generateMessage(
        'テスト案件',
        'テストタスク',
        'critical'
      );
      await this.speak(testMessage);
    } else {
      await this.speak('音声テストです。タスクが残っています。');
    }
  }
};
