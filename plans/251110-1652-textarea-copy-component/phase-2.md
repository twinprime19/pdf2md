# Phase 2: Clipboard Functionality

## Objective
Implement robust copy-to-clipboard functionality with modern API support and fallback compatibility.

## Tasks

### 2.1 Modern Clipboard API Implementation
**File: `/public/app.js`**

Add clipboard functionality:
```javascript
// Clipboard functionality
async function copyToClipboard(text) {
    try {
        // Check if Clipboard API is available and we're in secure context
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers or non-HTTPS
            return copyToClipboardFallback(text);
        }
    } catch (error) {
        console.warn('Clipboard API failed, trying fallback:', error);
        return copyToClipboardFallback(text);
    }
}

function copyToClipboardFallback(text) {
    try {
        // Create temporary textarea element
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);

        textArea.focus();
        textArea.select();

        // Use execCommand as fallback
        const result = document.execCommand('copy');
        document.body.removeChild(textArea);

        return result;
    } catch (error) {
        console.error('Clipboard fallback failed:', error);
        return false;
    }
}
```

### 2.2 Copy Button Event Handler
**File: `/public/app.js`**

Add event listener and feedback:
```javascript
// Copy button functionality
function setupCopyButton() {
    const copyBtn = document.getElementById('copyTextBtn');
    const copyText = copyBtn.querySelector('.copy-text');
    const extractedTextArea = document.getElementById('extractedText');

    copyBtn.addEventListener('click', async () => {
        const text = extractedTextArea.value;

        if (!text.trim()) {
            showTemporaryMessage(copyText, 'No text to copy', 'error');
            return;
        }

        // Disable button during copy operation
        copyBtn.disabled = true;

        const success = await copyToClipboard(text);

        if (success) {
            // Success feedback
            copyBtn.classList.add('copied');
            showTemporaryMessage(copyText, 'Copied!', 'success');

            // Reset after animation
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyText.textContent = 'Copy Text';
                copyBtn.disabled = false;
            }, 2000);
        } else {
            // Error feedback
            showTemporaryMessage(copyText, 'Copy failed', 'error');
            copyBtn.disabled = false;
        }
    });
}

function showTemporaryMessage(element, message, type) {
    const originalText = element.textContent;
    element.textContent = message;

    if (type === 'error') {
        element.style.color = '#dc3545';
    } else if (type === 'success') {
        element.style.color = '#ffffff';
    }

    setTimeout(() => {
        element.textContent = originalText;
        element.style.color = '';
    }, 2000);
}
```

### 2.3 Permission Handling
**File: `/public/app.js`**

Add permission check for Clipboard API:
```javascript
// Check clipboard permissions
async function checkClipboardPermission() {
    if (!navigator.permissions) {
        return 'unknown';
    }

    try {
        const permission = await navigator.permissions.query({
            name: 'clipboard-write'
        });
        return permission.state;
    } catch (error) {
        console.warn('Permission query failed:', error);
        return 'unknown';
    }
}

// Initialize clipboard functionality
async function initializeClipboard() {
    const permission = await checkClipboardPermission();

    if (permission === 'denied') {
        console.warn('Clipboard permission denied, fallback will be used');
    }

    setupCopyButton();
}
```

### 2.4 Error Handling & User Feedback
**File: `/public/app.js`**

Enhanced error handling:
```javascript
// Error handling for clipboard operations
function handleClipboardError(error) {
    console.error('Clipboard operation failed:', error);

    // Show user-friendly error message
    const errorMsg = getClipboardErrorMessage(error);
    showNotification(errorMsg, 'warning');
}

function getClipboardErrorMessage(error) {
    if (error.name === 'NotAllowedError') {
        return 'Clipboard access denied. Please allow clipboard permissions or use manual copy.';
    } else if (error.name === 'NotSupportedError') {
        return 'Clipboard not supported. Please manually select and copy the text.';
    } else {
        return 'Copy failed. Please try selecting the text manually.';
    }
}

// Notification system for clipboard feedback
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('clipboard-notification');

    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'clipboard-notification';
        notification.className = 'clipboard-notification';
        document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.className = `clipboard-notification ${type} show`;

    // Auto-hide after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}
```

### 2.5 CSS for Notifications
**File: `/public/styles.css`**

Add notification styles:
```css
/* Clipboard notifications */
.clipboard-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: 500;
    z-index: 1000;
    opacity: 0;
    transform: translateX(100px);
    transition: all 0.3s ease;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.clipboard-notification.show {
    opacity: 1;
    transform: translateX(0);
}

.clipboard-notification.success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
}

.clipboard-notification.warning {
    background: #fff3cd;
    color: #856404;
    border: 1px solid #ffeaa7;
}

.clipboard-notification.error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
}

/* Copy button states */
.copy-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none !important;
}
```

## Expected Outcome
- Copy functionality works across all modern browsers
- Graceful fallback for older browsers
- Clear user feedback for success/failure states
- Proper error handling and notifications
- No clipboard permission issues