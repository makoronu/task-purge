/**
 * 認証管理
 */
const Auth = {
  /** @type {firebase.User|null} */
  _currentUser: null,

  /** @type {boolean} */
  _initialized: false,

  /**
   * Firebase初期化
   * @returns {Promise<void>}
   */
  async init() {
    if (this._initialized) return;

    if (!isFirebaseConfigured()) {
      console.error('Firebase設定が未完了です');
      return;
    }

    try {
      firebase.initializeApp(firebaseConfig);
      this._initialized = true;
    } catch (error) {
      // 既に初期化済みの場合は無視
      if (error.code !== 'app/duplicate-app') {
        throw error;
      }
    }
  },

  /**
   * ログインページ初期化
   */
  async initLoginPage() {
    await this.init();

    // 既にログイン済みならメインページへ
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        window.location.href = '/';
      }
    });

    // ログインフォーム
    const form = document.getElementById('login-form');
    form.addEventListener('submit', e => this._handleLogin(e));
  },

  /**
   * ログイン処理
   * @param {Event} e
   */
  async _handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('login-btn');
    const loading = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');

    // UI更新
    loginBtn.disabled = true;
    loading.style.display = 'flex';
    errorMessage.style.display = 'none';

    try {
      await firebase.auth().signInWithEmailAndPassword(email, password);
      window.location.href = '/';
    } catch (error) {
      errorMessage.textContent = this._getErrorMessage(error.code);
      errorMessage.style.display = 'block';
    } finally {
      loginBtn.disabled = false;
      loading.style.display = 'none';
    }
  },

  /**
   * エラーメッセージを取得
   * @param {string} code
   * @returns {string}
   */
  _getErrorMessage(code) {
    const messages = {
      'auth/invalid-email': 'メールアドレスの形式が正しくありません',
      'auth/user-disabled': 'このアカウントは無効化されています',
      'auth/user-not-found': 'アカウントが見つかりません',
      'auth/wrong-password': 'パスワードが正しくありません',
      'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません',
      'auth/too-many-requests': 'ログイン試行回数が多すぎます。しばらく待ってから再試行してください'
    };
    return messages[code] || 'ログインに失敗しました';
  },

  /**
   * メインページ/管理画面用の認証チェック
   * @param {Function} onAuthenticated - 認証済み時のコールバック
   * @param {Function} onUnauthenticated - 未認証時のコールバック（省略時はログインページへリダイレクト）
   */
  async requireAuth(onAuthenticated, onUnauthenticated = null) {
    await this.init();

    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        this._currentUser = user;
        onAuthenticated(user);
      } else {
        this._currentUser = null;
        if (onUnauthenticated) {
          onUnauthenticated();
        } else {
          window.location.href = '/login.html';
        }
      }
    });
  },

  /**
   * 現在のユーザーを取得
   * @returns {firebase.User|null}
   */
  getCurrentUser() {
    return this._currentUser;
  },

  /**
   * ログアウト
   * @returns {Promise<void>}
   */
  async logout() {
    await firebase.auth().signOut();
    window.location.href = '/login.html';
  }
};
