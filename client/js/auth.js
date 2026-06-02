// client/js/auth.js
// Handles login and registration form logic
// Depends on: utils.js (must be loaded first)

// =====================================================
// PAGE INIT — runs when DOM is ready
// =====================================================
document.addEventListener('DOMContentLoaded', () => {

  // If already logged in, skip the auth page entirely
  // redirectIfLoggedIn() is defined in utils.js
  redirectIfLoggedIn();

  // Wire up form submit handlers
  initLoginForm();
  initRegisterForm();
});

// =====================================================
// LOGIN FORM
// =====================================================

/**
 * initLoginForm — Attaches submit handler to the login form
 * Validates fields, calls API, stores token on success
 */
function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    // Prevent default browser form submission
    e.preventDefault();

    // Get form field values
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const loginBtn = document.getElementById('login-btn');

    // ── Client-side validation ──────────────────────
    const validationError = validateLoginFields(email, password);
    if (validationError) {
      showAuthError('login', validationError);
      return;
    }

    // ── Clear previous messages ─────────────────────
    hideAuthMessages('login');

    // ── Show loading state on button ────────────────
    setLoading(loginBtn, true, 'Sign In →');

    try {
      // ── Call backend login endpoint ─────────────────
      // POST /api/auth/login
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (data.success) {
        // ── Success: store token + user data ───────────
        saveAuth(data.token, data.user);

        // Show success message briefly
        showAuthSuccess('login');

        // Redirect to dashboard after short delay
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 800);

      } else {
        // ── API returned an error ──────────────────────
        const message = data.message || 'Invalid email or password.';
        showAuthError('login', message);
        setLoading(loginBtn, false, 'Sign In →');

        // Shake the form for visual feedback
        shakeForm('login-form');
      }

    } catch (error) {
      // ── Unexpected error ───────────────────────────
      showAuthError('login', 'Something went wrong. Please try again.');
      setLoading(loginBtn, false, 'Sign In →');
      console.error('Login error:', error);
    }
  });
}

// =====================================================
// REGISTER FORM
// =====================================================

/**
 * initRegisterForm — Attaches submit handler to the register form
 * Validates all fields, calls API, stores token on success
 */
function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Get form field values
    const name     = document.getElementById('register-name').value.trim();
    const email    = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const setupKey = document.getElementById('register-setup-key').value.trim();
    const regBtn   = document.getElementById('register-btn');

    // ── Client-side validation ──────────────────────
    const validationError = validateRegisterFields(
      name, email, password, setupKey
    );
    if (validationError) {
      showAuthError('register', validationError);
      return;
    }

    // ── Clear previous messages ─────────────────────
    hideAuthMessages('register');

    // ── Show loading state ──────────────────────────
    setLoading(regBtn, true, 'Create Admin Account →');

    try {
      // ── Call backend register endpoint ─────────────
      // POST /api/auth/register
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, setupKey }),
      });

      if (data.success) {
        // ── Success: store token + user data ───────────
        saveAuth(data.token, data.user);

        // Show success message
        showAuthSuccess('register');

        // Redirect to dashboard
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 1000);

      } else {
        // ── API returned an error ──────────────────────
        const message = data.message || 'Registration failed. Please try again.';
        showAuthError('register', message);
        setLoading(regBtn, false, 'Create Admin Account →');
        shakeForm('register-form');
      }

    } catch (error) {
      showAuthError('register', 'Something went wrong. Please try again.');
      setLoading(regBtn, false, 'Create Admin Account →');
      console.error('Register error:', error);
    }
  });
}

// =====================================================
// FIELD VALIDATION
// =====================================================

/**
 * validateLoginFields — Validates login form inputs
 * Returns an error message string or null if valid
 *
 * @param {string} email
 * @param {string} password
 * @returns {string|null} Error message or null
 */
function validateLoginFields(email, password) {
  if (!email) {
    highlightField('login-email', true);
    return 'Please enter your email address.';
  }
  if (!isValidEmail(email)) {
    highlightField('login-email', true);
    return 'Please enter a valid email address.';
  }
  if (!password) {
    highlightField('login-password', true);
    return 'Please enter your password.';
  }
  if (password.length < 6) {
    highlightField('login-password', true);
    return 'Password must be at least 6 characters.';
  }
  // Clear any previous error highlights
  highlightField('login-email', false);
  highlightField('login-password', false);
  return null;
}

/**
 * validateRegisterFields — Validates all register form inputs
 * Returns an error message string or null if valid
 *
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @param {string} setupKey
 * @returns {string|null} Error message or null
 */
function validateRegisterFields(name, email, password, setupKey) {
  if (!name || name.length < 2) {
    highlightField('register-name', true);
    return 'Please enter your full name (minimum 2 characters).';
  }
  if (!email) {
    highlightField('register-email', true);
    return 'Please enter your email address.';
  }
  if (!isValidEmail(email)) {
    highlightField('register-email', true);
    return 'Please enter a valid email address.';
  }
  if (!password) {
    highlightField('register-password', true);
    return 'Please enter a password.';
  }
  if (password.length < 6) {
    highlightField('register-password', true);
    return 'Password must be at least 6 characters long.';
  }
  if (!setupKey) {
    highlightField('register-setup-key', true);
    return 'Please enter the Admin Setup Key.';
  }

  // Clear any previous error highlights
  ['register-name', 'register-email',
   'register-password', 'register-setup-key'].forEach(id => {
    highlightField(id, false);
  });

  return null;
}

/**
 * isValidEmail — Basic email format check using regex
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// =====================================================
// UI FEEDBACK HELPERS
// =====================================================

/**
 * showAuthError — Display an error message on the auth form
 * @param {string} formType - 'login' or 'register'
 * @param {string} message  - Error text to display
 */
function showAuthError(formType, message) {
  const errorEl = document.getElementById(`${formType}-error`);
  const textEl  = document.getElementById(`${formType}-error-text`);
  if (!errorEl) return;

  if (textEl) textEl.textContent = message;
  errorEl.classList.add('visible');

  // Hide success if showing
  const successEl = document.getElementById(`${formType}-success`);
  if (successEl) successEl.classList.remove('visible');

  // Auto-hide error after 6 seconds
  setTimeout(() => {
    errorEl.classList.remove('visible');
  }, 6000);
}

/**
 * showAuthSuccess — Display a success message on the auth form
 * @param {string} formType - 'login' or 'register'
 */
function showAuthSuccess(formType) {
  const successEl = document.getElementById(`${formType}-success`);
  if (!successEl) return;
  successEl.classList.add('visible');

  // Hide error if showing
  const errorEl = document.getElementById(`${formType}-error`);
  if (errorEl) errorEl.classList.remove('visible');
}

/**
 * hideAuthMessages — Hide both error and success messages
 * @param {string} formType - 'login' or 'register'
 */
function hideAuthMessages(formType) {
  const errorEl   = document.getElementById(`${formType}-error`);
  const successEl = document.getElementById(`${formType}-success`);
  if (errorEl)   errorEl.classList.remove('visible');
  if (successEl) successEl.classList.remove('visible');
}

/**
 * highlightField — Add or remove error styling on an input
 * @param {string}  fieldId  - Input element ID
 * @param {boolean} hasError - true to add error class, false to remove
 */
function highlightField(fieldId, hasError) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  if (hasError) {
    field.classList.add('error');
    // Remove error class when user starts typing
    field.addEventListener('input', () => {
      field.classList.remove('error');
    }, { once: true }); // only fires once per highlight
  } else {
    field.classList.remove('error');
  }
}

/**
 * shakeForm — Apply a quick shake animation to a form
 * Provides tactile feedback when login fails
 * @param {string} formId - Form element ID
 */
function shakeForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  // Add shake class
  form.style.animation = 'shakeX 0.4s ease';

  // Remove after animation completes
  setTimeout(() => {
    form.style.animation = '';
  }, 400);
}

// =====================================================
// INLINE KEYFRAME — shake animation
// Injected into page stylesheet dynamically
// =====================================================
(function injectShakeAnimation() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shakeX {
      0%, 100% { transform: translateX(0);   }
      15%       { transform: translateX(-8px); }
      30%       { transform: translateX(8px);  }
      45%       { transform: translateX(-6px); }
      60%       { transform: translateX(6px);  }
      75%       { transform: translateX(-3px); }
      90%       { transform: translateX(3px);  }
    }
  `;
  document.head.appendChild(style);
})();