/**
 * メインアプリケーション
 */
const App = {
  /** @type {number|null} */
  _intervalId: null,

  /** @type {number|null} */
  _countdownId: null,

  /** @type {boolean} */
  _isChecking: false,

  /** @type {Date|null} */
  _nextCheckTime: null,

  // DOM要素
  _elements: {},

  /**
   * アプリケーション初期化
   */
  async init() {
    this._cacheElements();
    this._bindEvents();
    this._loadSavedSettings();
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
      saveBtn: document.getElementById('save-btn'),
      testSpeechBtn: document.getElementById('test-speech-btn'),
      startBtn: document.getElementById('start-btn'),
      stopBtn: document.getElementById('stop-btn'),
      statusBadge: document.getElementById('status-badge'),
      countdown: document.getElementById('countdown'),
      taskList: document.getElementById('task-list'),
      errorMessage: document.getElementById('error-message')
    };
  },

  /**
   * イベントをバインド
   */
  _bindEvents() {
    // APIトークン変更時にボード読み込み
    this._elements.apiToken.addEventListener('change', () => this._onTokenChange());

    // ボード変更時にカラム読み込み
    this._elements.boardSelect.addEventListener('change', () => this._onBoardChange());

    // 保存ボタン
    this._elements.saveBtn.addEventListener('click', () => this._saveSettings());

    // 音声テストボタン
    this._elements.testSpeechBtn.addEventListener('click', () => this._testSpeech());

    // 開始/停止ボタン
    this._elements.startBtn.addEventListener('click', () => this._startMonitoring());
    this._elements.stopBtn.addEventListener('click', () => this._stopMonitoring());
  },

  /**
   * 保存済み設定を読み込み
   */
  async _loadSavedSettings() {
    const settings = Config.getAll();

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
      }
    }
  },

  /**
   * トークン変更時の処理
   */
  async _onTokenChange() {
    const token = this._elements.apiToken.value.trim();
    if (!token) return;

    Config.saveApiToken(token);
    await this._loadBoards();
  },

  /**
   * ボード一覧を読み込み
   */
  async _loadBoards() {
    try {
      this._showLoading(this._elements.boardSelect, '読み込み中...');
      const boards = await MondayAPI.getBoards();

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
   * ボード変更時の処理
   */
  async _onBoardChange() {
    const boardId = this._elements.boardSelect.value;
    if (!boardId) return;

    Config.saveBoardId(boardId);
    await this._loadColumns();
  },

  /**
   * カラム一覧を読み込み
   */
  async _loadColumns() {
    const boardId = this._elements.boardSelect.value;
    if (!boardId) return;

    try {
      const columns = await MondayAPI.getColumns(boardId);

      // 各カラムセレクトを更新
      [this._elements.priorityColumn, this._elements.dateColumn, this._elements.statusColumn]
        .forEach(select => {
          select.innerHTML = '<option value="">選択してください</option>';
          columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col.id;
            option.textContent = `${col.title} (${col.type})`;
            select.appendChild(option);
          });
          select.disabled = false;
        });
    } catch (error) {
      this._showError(error.message);
    }
  },

  /**
   * 設定を保存
   */
  _saveSettings() {
    Config.saveAll({
      apiToken: this._elements.apiToken.value.trim(),
      boardId: this._elements.boardSelect.value,
      priorityColumn: this._elements.priorityColumn.value,
      dateColumn: this._elements.dateColumn.value,
      statusColumn: this._elements.statusColumn.value
    });
    alert('設定を保存しました');
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
   * 監視開始
   */
  async _startMonitoring() {
    if (!Config.isConfigured()) {
      this._showError('設定が完了していません。全ての項目を入力してください。');
      return;
    }

    this._elements.startBtn.disabled = true;
    this._elements.stopBtn.disabled = false;
    this._elements.statusBadge.textContent = '監視中';
    this._elements.statusBadge.classList.remove('badge-stopped');
    this._elements.statusBadge.classList.add('badge-running');

    // 初回チェック
    await this._checkTasks();

    // 定期チェック開始
    this._intervalId = setInterval(() => this._checkTasks(), CONSTANTS.DEFAULT_INTERVAL_MS);

    // カウントダウン開始
    this._startCountdown();
  },

  /**
   * 監視停止
   */
  _stopMonitoring() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    if (this._countdownId) {
      clearInterval(this._countdownId);
      this._countdownId = null;
    }

    this._elements.startBtn.disabled = false;
    this._elements.stopBtn.disabled = true;
    this._elements.statusBadge.textContent = '停止中';
    this._elements.statusBadge.classList.remove('badge-running');
    this._elements.statusBadge.classList.add('badge-stopped');
    this._elements.countdown.textContent = '--:--';
  },

  /**
   * タスクチェック
   */
  async _checkTasks() {
    // 二重実行防止
    if (this._isChecking) return;
    this._isChecking = true;

    try {
      const boardId = Config.getBoardId();
      const items = await MondayAPI.getItems(boardId);
      const urgentTasks = this._filterUrgentTasks(items);

      this._renderTasks(urgentTasks);

      if (urgentTasks.length > 0) {
        await Speech.remindTasks(urgentTasks);
      }

      // 次回チェック時間を更新
      this._nextCheckTime = new Date(Date.now() + CONSTANTS.DEFAULT_INTERVAL_MS);
    } catch (error) {
      this._showError(error.message);
    } finally {
      this._isChecking = false;
    }
  },

  /**
   * 緊急・高優先度 + 当日期限のタスクをフィルタ
   * @param {Array} items
   * @returns {Array}
   */
  _filterUrgentTasks(items) {
    const priorityColId = Config.getPriorityColumn();
    const dateColId = Config.getDateColumn();
    const statusColId = Config.getStatusColumn();

    return items.filter(item => {
      const priorityCol = item.column_values.find(c => c.id === priorityColId);
      const dateCol = item.column_values.find(c => c.id === dateColId);
      const statusCol = item.column_values.find(c => c.id === statusColId);

      const priorityValue = priorityCol?.text || '';
      const dateValue = dateCol?.text || '';
      const statusValue = statusCol?.text || '';

      const isHighPriority = this._isHighPriority(priorityValue);
      const isToday = this._isToday(dateValue);
      const isCompleted = this._isCompleted(statusValue);

      return isHighPriority && isToday && !isCompleted;
    }).map(item => {
      const priorityCol = item.column_values.find(c => c.id === priorityColId);
      const priorityValue = priorityCol?.text || '';
      return {
        id: item.id,
        name: item.name,
        priority: this._getPriorityLevel(priorityValue)
      };
    });
  },

  /**
   * 優先度が緊急または高かどうか判定
   * @param {string} value
   * @returns {boolean}
   */
  _isHighPriority(value) {
    const normalized = value.toLowerCase().trim();
    const criticalValues = CONSTANTS.PRIORITY_VALUES.CRITICAL.map(v => v.toLowerCase());
    const highValues = CONSTANTS.PRIORITY_VALUES.HIGH.map(v => v.toLowerCase());
    return criticalValues.includes(normalized) || highValues.includes(normalized);
  },

  /**
   * 優先度レベルを取得
   * @param {string} value
   * @returns {'critical'|'high'|'normal'}
   */
  _getPriorityLevel(value) {
    const normalized = value.toLowerCase().trim();
    const criticalValues = CONSTANTS.PRIORITY_VALUES.CRITICAL.map(v => v.toLowerCase());
    if (criticalValues.includes(normalized)) return 'critical';
    return 'high';
  },

  /**
   * 当日かどうか判定（JST）
   * @param {string} dateStr
   * @returns {boolean}
   */
  _isToday(dateStr) {
    if (!dateStr) return false;

    try {
      const today = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
      const target = new Date(dateStr).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
      return today === target;
    } catch {
      return false;
    }
  },

  /**
   * 完了かどうか判定
   * @param {string} value
   * @returns {boolean}
   */
  _isCompleted(value) {
    const normalized = value.toLowerCase().trim();
    return CONSTANTS.COMPLETED_VALUES.map(v => v.toLowerCase()).includes(normalized);
  },

  /**
   * タスク一覧を描画
   * @param {Array} tasks
   */
  _renderTasks(tasks) {
    const list = this._elements.taskList;

    if (tasks.length === 0) {
      list.innerHTML = '<li class="empty">未完了の緊急・高優先度タスクはありません</li>';
      return;
    }

    list.innerHTML = tasks.map(task => `
      <li class="priority-${task.priority}">
        <div class="task-name">${this._escapeHtml(task.name)}</div>
        <div class="task-meta">
          <span class="task-priority ${task.priority}">
            ${task.priority === 'critical' ? '緊急' : '高'}
          </span>
          期限: 今日
        </div>
      </li>
    `).join('');
  },

  /**
   * カウントダウン開始
   */
  _startCountdown() {
    this._nextCheckTime = new Date(Date.now() + CONSTANTS.DEFAULT_INTERVAL_MS);

    this._countdownId = setInterval(() => {
      if (!this._nextCheckTime) return;

      const remaining = this._nextCheckTime - Date.now();
      if (remaining <= 0) {
        this._elements.countdown.textContent = '確認中...';
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      this._elements.countdown.textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
  },

  /**
   * ローディング表示
   * @param {HTMLSelectElement} select
   * @param {string} message
   */
  _showLoading(select, message) {
    select.innerHTML = `<option value="">${message}</option>`;
    select.disabled = true;
  },

  /**
   * エラー表示
   * @param {string} message
   */
  _showError(message) {
    this._elements.errorMessage.textContent = message;
    this._elements.errorMessage.style.display = 'block';
  },

  /**
   * エラー非表示
   */
  _hideError() {
    this._elements.errorMessage.style.display = 'none';
  },

  /**
   * HTMLエスケープ
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => App.init());
