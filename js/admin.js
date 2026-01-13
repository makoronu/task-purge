/**
 * 管理画面ロジック（簡素化版）
 * - ボード選択廃止（全ボード監視）
 * - カラム選択廃止（固定カラムID使用）
 */
const Admin = {
  _elements: {},
  _users: [],

  /**
   * 初期化
   */
  async init() {
    this._cacheElements();
    this._bindEvents();
    await this._loadSavedSettings();
    await Speech.init();
  },

  /**
   * DOM要素をキャッシュ
   */
  _cacheElements() {
    this._elements = {
      apiToken: document.getElementById('api-token'),
      userSelect: document.getElementById('user-select'),
      reconnectBtn: document.getElementById('reconnect-btn'),
      intervalMinutes: document.getElementById('interval-minutes'),
      claudeApiKey: document.getElementById('claude-api-key'),
      saveBtn: document.getElementById('save-btn'),
      testSpeechBtn: document.getElementById('test-speech-btn'),
      errorMessage: document.getElementById('error-message'),
      successMessage: document.getElementById('success-message')
    };
  },

  /**
   * イベントをバインド
   */
  _bindEvents() {
    this._elements.apiToken.addEventListener('change', () => this._onTokenChange());
    this._elements.reconnectBtn.addEventListener('click', () => this._reconnect());
    this._elements.saveBtn.addEventListener('click', () => this._saveSettings());
    this._elements.testSpeechBtn.addEventListener('click', () => this._testSpeech());
  },

  /**
   * 保存済み設定を読み込み
   */
  async _loadSavedSettings() {
    try {
      const user = Auth.getCurrentUser();
      if (!user) return;

      const db = firebase.firestore();
      const doc = await db.collection('settings').doc(user.uid).get();

      if (doc.exists) {
        const settings = doc.data();

        if (settings.apiToken) {
          this._elements.apiToken.value = settings.apiToken;
          await this._loadUsers();

          if (settings.userId) {
            this._elements.userSelect.value = settings.userId;
          }
        }

        // リマインド間隔（デフォルト15分）
        if (settings.intervalMinutes) {
          this._elements.intervalMinutes.value = settings.intervalMinutes;
        }

        // Claude APIキー（任意）
        if (settings.claudeApiKey) {
          this._elements.claudeApiKey.value = settings.claudeApiKey;
        }
      }
    } catch (error) {
      this._showError('設定の読み込みに失敗しました: ' + error.message);
    }
  },

  /**
   * トークン変更時
   */
  async _onTokenChange() {
    const token = this._elements.apiToken.value.trim();
    if (!token) return;

    await this._loadUsers();
  },

  /**
   * 再接続（Service Worker再登録 + ユーザー再取得）
   */
  async _reconnect() {
    const token = this._elements.apiToken.value.trim();
    if (!token) {
      this._showError('APIトークンを入力してください');
      return;
    }

    this._elements.reconnectBtn.disabled = true;
    this._elements.reconnectBtn.textContent = '接続中...';

    try {
      // Service Workerを再登録
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
        await navigator.serviceWorker.register('/sw.js');
      }

      // ユーザー一覧を再取得
      await this._loadUsers();
      this._showSuccess('再接続しました');
    } catch (error) {
      this._showError('再接続に失敗しました: ' + error.message);
    } finally {
      this._elements.reconnectBtn.disabled = false;
      this._elements.reconnectBtn.textContent = '再接続';
    }
  },

  /**
   * ユーザー一覧を読み込み（users APIを使用）
   */
  async _loadUsers() {
    const token = this._elements.apiToken.value.trim();
    if (!token) return;

    try {
      this._showLoading(this._elements.userSelect, '読み込み中...');

      // アカウント内の全ユーザーを取得
      const query = `query { users { id name email } }`;
      const data = await this._fetchMonday(query, token);
      this._users = data?.users || [];

      this._elements.userSelect.innerHTML = '<option value="">選択してください</option>';
      this._users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.name} (${user.email || 'メールなし'})`;
        this._elements.userSelect.appendChild(option);
      });
      this._elements.userSelect.disabled = false;
      this._hideError();
    } catch (error) {
      this._showError('ユーザー一覧の取得に失敗しました: ' + error.message);
      this._elements.userSelect.innerHTML = '<option value="">エラー</option>';
    }
  },

  /**
   * 設定を保存（簡素化版）
   */
  async _saveSettings() {
    const intervalValue = parseInt(this._elements.intervalMinutes.value, 10);
    const intervalMinutes = (intervalValue >= 1 && intervalValue <= 60) ? intervalValue : 15;

    const settings = {
      apiToken: this._elements.apiToken.value.trim(),
      userId: this._elements.userSelect.value,
      intervalMinutes: intervalMinutes,
      claudeApiKey: this._elements.claudeApiKey.value.trim() || null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // バリデーション
    if (!settings.apiToken) {
      this._showError('APIトークンを入力してください');
      return;
    }
    if (!settings.userId) {
      this._showError('監視対象ユーザーを選択してください');
      return;
    }

    this._elements.saveBtn.disabled = true;

    try {
      const user = Auth.getCurrentUser();
      const db = firebase.firestore();
      await db.collection('settings').doc(user.uid).set(settings, { merge: true });

      this._showSuccess('設定を保存しました');
    } catch (error) {
      this._showError('保存に失敗しました: ' + error.message);
    } finally {
      this._elements.saveBtn.disabled = false;
    }
  },

  /**
   * 音声テスト
   */
  async _testSpeech() {
    try {
      // テスト時は入力中のAPIキーを一時的に設定
      const currentKey = this._elements.claudeApiKey.value.trim() || null;
      Speech.setClaudeApiKey(currentKey);
      await Speech.test();
    } catch (error) {
      this._showError('音声テストに失敗しました: ' + error.message);
    }
  },

  /**
   * Monday APIを呼び出し
   * @param {string} query
   * @param {string} token
   * @param {Object} variables
   * @returns {Promise<Object>}
   */
  async _fetchMonday(query, token, variables = {}) {
    const response = await fetch(CONSTANTS.MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ query, variables })
    });

    if (response.status === 401) {
      throw new Error('APIトークンが無効です');
    }

    if (response.status === 429) {
      throw new Error('APIレート制限に達しました');
    }

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      throw new Error(data.errors[0].message);
    }

    return data.data;
  },

  /**
   * ローディング表示
   */
  _showLoading(select, message) {
    select.innerHTML = `<option value="">${message}</option>`;
    select.disabled = true;
  },

  /**
   * エラー表示
   */
  _showError(message) {
    this._elements.successMessage.style.display = 'none';
    this._elements.errorMessage.textContent = message;
    this._elements.errorMessage.style.display = 'block';
  },

  /**
   * 成功表示
   */
  _showSuccess(message) {
    this._elements.errorMessage.style.display = 'none';
    this._elements.successMessage.textContent = message;
    this._elements.successMessage.style.display = 'block';
    setTimeout(() => {
      this._elements.successMessage.style.display = 'none';
    }, 3000);
  },

  /**
   * エラー非表示
   */
  _hideError() {
    this._elements.errorMessage.style.display = 'none';
  }
};
