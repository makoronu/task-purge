/**
 * 管理画面ロジック
 */
const Admin = {
  _elements: {},
  _columns: [],
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
      boardSelect: document.getElementById('board-select'),
      priorityColumn: document.getElementById('priority-column'),
      dateColumn: document.getElementById('date-column'),
      statusColumn: document.getElementById('status-column'),
      personColumn: document.getElementById('person-column'),
      userSelect: document.getElementById('user-select'),
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
    this._elements.boardSelect.addEventListener('change', () => this._onBoardChange());
    this._elements.personColumn.addEventListener('change', () => this._onPersonColumnChange());
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
          await this._loadBoards();

          if (settings.boardId) {
            this._elements.boardSelect.value = settings.boardId;
            await this._loadColumns();

            if (settings.priorityColumn) {
              this._elements.priorityColumn.value = settings.priorityColumn;
            }
            if (settings.dateColumn) {
              this._elements.dateColumn.value = settings.dateColumn;
            }
            if (settings.statusColumn) {
              this._elements.statusColumn.value = settings.statusColumn;
            }
            if (settings.personColumn) {
              this._elements.personColumn.value = settings.personColumn;
              await this._loadUsers();

              if (settings.userId) {
                this._elements.userSelect.value = settings.userId;
              }
            }
          }
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

    await this._loadBoards();
  },

  /**
   * ボード一覧を読み込み
   */
  async _loadBoards() {
    const token = this._elements.apiToken.value.trim();
    if (!token) return;

    try {
      this._showLoading(this._elements.boardSelect, '読み込み中...');

      const query = `query { boards(limit: 50) { id name } }`;
      const data = await this._fetchMonday(query, token);
      const boards = data?.boards || [];

      this._elements.boardSelect.innerHTML = '<option value="">選択してください</option>';
      boards.forEach(board => {
        const option = document.createElement('option');
        option.value = board.id;
        option.textContent = board.name;
        this._elements.boardSelect.appendChild(option);
      });
      this._elements.boardSelect.disabled = false;
      this._hideError();
    } catch (error) {
      this._showError(error.message);
      this._elements.boardSelect.innerHTML = '<option value="">エラー</option>';
    }
  },

  /**
   * ボード変更時
   */
  async _onBoardChange() {
    const boardId = this._elements.boardSelect.value;
    if (!boardId) return;

    await this._loadColumns();
  },

  /**
   * カラム一覧を読み込み
   */
  async _loadColumns() {
    const boardId = this._elements.boardSelect.value;
    const token = this._elements.apiToken.value.trim();
    if (!boardId || !token) return;

    try {
      const query = `
        query ($boardId: [ID!]!) {
          boards(ids: $boardId) {
            columns { id title type }
          }
        }
      `;
      const data = await this._fetchMonday(query, token, { boardId: [boardId] });
      this._columns = data?.boards?.[0]?.columns || [];

      // 各カラムセレクトを更新
      const columnSelects = [
        this._elements.priorityColumn,
        this._elements.dateColumn,
        this._elements.statusColumn
      ];

      columnSelects.forEach(select => {
        select.innerHTML = '<option value="">選択してください</option>';
        this._columns.forEach(col => {
          const option = document.createElement('option');
          option.value = col.id;
          option.textContent = `${col.title} (${col.type})`;
          select.appendChild(option);
        });
        select.disabled = false;
      });

      // 担当者カラムはpeople型のみ
      this._elements.personColumn.innerHTML = '<option value="">選択してください</option>';
      this._columns
        .filter(col => col.type === 'people' || col.type === 'multiple-person')
        .forEach(col => {
          const option = document.createElement('option');
          option.value = col.id;
          option.textContent = col.title;
          this._elements.personColumn.appendChild(option);
        });
      this._elements.personColumn.disabled = false;

      // ユーザー選択をリセット
      this._elements.userSelect.innerHTML = '<option value="">担当者カラムを選択してください</option>';
      this._elements.userSelect.disabled = true;
    } catch (error) {
      this._showError(error.message);
    }
  },

  /**
   * 担当者カラム変更時
   */
  async _onPersonColumnChange() {
    await this._loadUsers();
  },

  /**
   * ユーザー一覧を読み込み
   */
  async _loadUsers() {
    const boardId = this._elements.boardSelect.value;
    const token = this._elements.apiToken.value.trim();
    if (!boardId || !token) return;

    try {
      // ボードのsubscribersからユーザーを取得
      const query = `
        query ($boardId: [ID!]!) {
          boards(ids: $boardId) {
            subscribers { id name email }
          }
        }
      `;
      const data = await this._fetchMonday(query, token, { boardId: [boardId] });
      this._users = data?.boards?.[0]?.subscribers || [];

      this._elements.userSelect.innerHTML = '<option value="">選択してください</option>';
      this._users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.name} (${user.email || 'メールなし'})`;
        this._elements.userSelect.appendChild(option);
      });
      this._elements.userSelect.disabled = false;
    } catch (error) {
      this._showError('ユーザー一覧の取得に失敗しました: ' + error.message);
    }
  },

  /**
   * 設定を保存
   */
  async _saveSettings() {
    const settings = {
      apiToken: this._elements.apiToken.value.trim(),
      boardId: this._elements.boardSelect.value,
      priorityColumn: this._elements.priorityColumn.value,
      dateColumn: this._elements.dateColumn.value,
      statusColumn: this._elements.statusColumn.value,
      personColumn: this._elements.personColumn.value,
      userId: this._elements.userSelect.value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // バリデーション
    if (!settings.apiToken) {
      this._showError('APIトークンを入力してください');
      return;
    }
    if (!settings.boardId) {
      this._showError('ボードを選択してください');
      return;
    }
    if (!settings.priorityColumn || !settings.dateColumn || !settings.statusColumn) {
      this._showError('全てのカラムを選択してください');
      return;
    }
    if (!settings.personColumn || !settings.userId) {
      this._showError('担当者カラムとユーザーを選択してください');
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
