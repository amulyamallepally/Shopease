// ShopSphere Authentication Script
// Handles User Sign In and Sign Up API submissions, handles credentials storage, and redirects

document.addEventListener('DOMContentLoaded', () => {
  setupAuthForms();
});

/**
 * Binds submit events to registration and login forms.
 */
function setupAuthForms() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  // Check URL query parameters for custom notification warnings (like session expiry)
  handleSessionStatusNotifications();

  // 1. Process Login Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      if (!email || !password) {
        showNotification('Please fill in all fields.', 'error');
        return;
      }

      setSubmittingState(loginForm, true);

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
          // Store token and user details in localStorage
          localStorage.setItem('shopsphere_token', data.token);
          localStorage.setItem('shopsphere_user', JSON.stringify(data.user));

          showNotification(data.message || 'Login successful!', 'success');

          // Navigate based on redirect parameter, else default to index
          setTimeout(() => {
            const urlParams = new URLSearchParams(window.location.search);
            const redirectPage = urlParams.get('redirect');
            if (redirectPage) {
              window.location.href = `/${redirectPage}`;
            } else {
              window.location.href = '/index.html';
            }
          }, 1000);
        } else {
          showNotification(data.message || 'Authentication failed.', 'error');
        }
      } catch (error) {
        console.error('Login error:', error);
        showNotification('Network connection error. Check if backend is running.', 'error');
      } finally {
        setSubmittingState(loginForm, false);
      }
    });
  }

  // 2. Process Registration Submission
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      // Basic field checks
      if (!name || !email || !password || !confirmPassword) {
        showNotification('Please fill in all fields.', 'error');
        return;
      }

      if (password.length < 6) {
        showNotification('Password must be at least 6 characters.', 'error');
        return;
      }

      if (password !== confirmPassword) {
        showNotification('Passwords do not match.', 'error');
        return;
      }

      setSubmittingState(registerForm, true);

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (data.success) {
          // Store user session
          localStorage.setItem('shopsphere_token', data.token);
          localStorage.setItem('shopsphere_user', JSON.stringify(data.user));

          showNotification('Registration successful! Welcome to ShopSphere.', 'success');

          setTimeout(() => {
            window.location.href = '/index.html';
          }, 1500);
        } else {
          showNotification(data.message || 'Registration failed.', 'error');
        }
      } catch (error) {
        console.error('Registration error:', error);
        showNotification('Network connection error. Check if backend is running.', 'error');
      } finally {
        setSubmittingState(registerForm, false);
      }
    });
  }
}

/**
 * Reads URL arguments to output helpful alerts (e.g. session expired, redirected from checkout).
 */
function handleSessionStatusNotifications() {
  const urlParams = new URLSearchParams(window.location.search);
  const session = urlParams.get('session');
  const redirect = urlParams.get('redirect');

  if (session === 'expired') {
    setTimeout(() => {
      showNotification('Your session has expired. Please log in again.', 'error');
    }, 500);
  } else if (redirect) {
    setTimeout(() => {
      showNotification('Please log in to continue to ' + redirect.replace('.html', ''), 'error');
    }, 500);
  }
}

/**
 * Disables form buttons during API calls to prevent duplicate submissions.
 */
function setSubmittingState(formElement, isSubmitting) {
  const submitBtn = formElement.querySelector('button[type="submit"]');
  if (!submitBtn) return;

  if (isSubmitting) {
    submitBtn.disabled = true;
    submitBtn.dataset.originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = `
      <span class="spinner" style="display:inline-block; width:16px; height:16px; border-width:2px; margin:0; vertical-align:middle;"></span>
      Processing...
    `;
  } else {
    submitBtn.disabled = false;
    submitBtn.innerHTML = submitBtn.dataset.originalText || 'Submit';
  }
}
