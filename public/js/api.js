const API_BASE_URL = `${window.location.origin}/api`;

// Storage helper
const storage = {
    setToken: (token) => localStorage.setItem('token', token),
    getToken: () => localStorage.getItem('token'),
    setUser: (user) => localStorage.setItem('user', JSON.stringify(user)),
    getUser: () => {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },
    clear: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
};

function normalizeRole(role) {
    return (role || '').toString().trim().toLowerCase();
}

// API helper function
async function apiCall(endpoint, options = {}) {
    const token = storage.getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        let data = null;
        const rawBody = await response.text();
        if (rawBody) {
            try {
                data = JSON.parse(rawBody);
            } catch (parseError) {
                data = rawBody;
            }
        }

        if (!response.ok) {
            const message = data && typeof data === 'object' && data.message ? data.message : 'Request failed';
            const error = new Error(message);
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    } catch (error) {
        throw error;
    }
}

// Auth API
const authAPI = {
    register: async (userData) => {
        return await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },
    login: async (identifier, password) => {
        return await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, password })
        });
    },
    getMe: async () => {
        return await apiCall('/auth/me');
    },
    forgot: async (emailOrPhone) => {
        const payload = emailOrPhone.includes('@') ? { email: emailOrPhone } : { phone: emailOrPhone };
        return await apiCall('/auth/forgot', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
    reset: async (identifier, token, newPassword) => {
        const payload = identifier.includes('@') ? { email: identifier, token, newPassword } : { phone: identifier, token, newPassword };
        return await apiCall('/auth/reset', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }
};

// Complaints API
const complaintsAPI = {
    create: async (complaintData, files = {}) => {
        const formData = new FormData();
        
        formData.append('title', complaintData.title);
        formData.append('description', complaintData.description);
        formData.append('category', complaintData.category);
        if (complaintData.subcategory) {
            formData.append('subcategory', complaintData.subcategory);
        }
        formData.append('priority', complaintData.priority || 'medium');

        if (files.photos) {
            Array.from(files.photos).forEach(photo => {
                formData.append('photos', photo);
            });
        }

        if (files.video) {
            formData.append('video', files.video);
        }

        if (files.voice) {
            // Append blob directly - FormData handles Blob objects correctly
            formData.append('voice', files.voice, 'voice-recording.webm');
        }

        const token = storage.getToken();
        const response = await fetch(`${API_BASE_URL}/complaints`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        return await response.json();
    },
    getAll: async (filters = {}) => {
        const queryString = new URLSearchParams(filters).toString();
        return await apiCall(`/complaints${queryString ? '?' + queryString : ''}`);
    },
    getById: async (id) => {
        return await apiCall(`/complaints/${id}`);
    },
    updateStatus: async (id, status, notes) => {
        return await apiCall(`/complaints/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status, adminNotes: notes })
        });
    },
    assign: async (id, assignedTo) => {
        return await apiCall(`/complaints/${id}/assign`, {
            method: 'PUT',
            body: JSON.stringify({ assignedTo })
        });
    },
    getStats: async () => {
        return await apiCall('/complaints/stats/summary');
    },
    submitFeedback: async (id, rating, comment) => {
        return await apiCall(`/complaints/${id}/feedback`, {
            method: 'POST',
            body: JSON.stringify({ rating, comment })
        });
    }
};

// Users API
const usersAPI = {
    getAll: async () => {
        return await apiCall('/users');
    },
    create: async (user) => {
        return await apiCall('/users', {
            method: 'POST',
            body: JSON.stringify(user)
        });
    },
    update: async (id, update) => {
        return await apiCall(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(update)
        });
    },
    remove: async (id) => {
        return await apiCall(`/users/${id}`, {
            method: 'DELETE'
        });
    },
    getNotifications: async () => {
        return await apiCall('/users/notifications');
    },
    markNotificationRead: async (id) => {
        return await apiCall(`/users/notifications/${id}/read`, {
            method: 'PUT'
        });
    },
    markAllNotificationsRead: async () => {
        return await apiCall('/users/notifications/read-all', {
            method: 'PUT'
        });
    }
};

// Utility functions
function broadcastMessage(type, message, target) {
    const defaultSelector = type === 'error' ? '.error-message' : '.success-message';
    let nodes = [];

    if (typeof target === 'string') {
        nodes = Array.from(document.querySelectorAll(target));
    } else if (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement) {
        nodes = [target];
    } else if (target && typeof target.length === 'number') {
        nodes = Array.from(target);
    }

    if (nodes.length === 0) {
        nodes = Array.from(document.querySelectorAll(defaultSelector));
    }

    if (nodes.length === 0) {
        alert(message);
        return;
    }

    const hideDelay = type === 'error' ? 5000 : 3000;

    nodes.forEach(node => {
        if (!node) return;
        node.textContent = message;
        node.style.display = 'block';
        if (node.__messageTimeout) {
            clearTimeout(node.__messageTimeout);
        }
        node.__messageTimeout = setTimeout(() => {
            node.style.display = 'none';
        }, hideDelay);
    });
}

function showError(message, target) {
    broadcastMessage('error', message, target);
}

function showSuccess(message, target) {
    broadcastMessage('success', message, target);
}

// Password policy validation helper
// Requirements: 8-13 chars, one uppercase, one lowercase, one number, one special char
function isValidPassword(password) {
    if (!password || password.length < 8 || password.length > 13) return false;
    const allowed = /^[A-Za-z0-9!@#$%&*]{8,13}$/;
    return allowed.test(password) && 
           /[A-Z]/.test(password) && 
           /[a-z]/.test(password) && 
           /[0-9]/.test(password) && 
           /[!@#$%&*]/.test(password);
}

function attachPasswordToggle(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (!input || !toggle) return;

    const updateState = () => {
        const isVisible = input.type === 'text';
        toggle.dataset.visible = isVisible ? 'true' : 'false';
        toggle.setAttribute('aria-label', isVisible ? 'Hide password' : 'Show password');
        toggle.setAttribute('aria-pressed', String(isVisible));
    };

    toggle.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
        updateState();
    });

    updateState();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusClass(status) {
    const statusMap = {
        'pending': 'status-pending',
        'in-progress': 'status-in-progress',
        'completed': 'status-completed',
        'rejected': 'status-rejected'
    };
    return statusMap[status] || 'status-pending';
}

function getPriorityColor(priority) {
    const priorityColors = {
        'low': '#64B5F6',      // Light Blue
        'medium': '#42A5F5',   // Medium Blue
        'high': '#1E88E5',     // Blue
        'urgent': '#1565C0'    // Dark Blue
    };
    return priorityColors[priority] || '#6c757d';
}

function getPriorityStyle(priority) {
    const color = getPriorityColor(priority);
    return `color: ${color}; font-weight: bold;`;
}

const PRIORITY_DETAILS = {
    low: {
        label: 'Low',
        caption: 'Routine improvement',
        pulse: '#28a745'
    },
    medium: {
        label: 'Medium',
        caption: 'Needs scheduling',
        pulse: '#ffc107'
    },
    high: {
        label: 'High',
        caption: 'Needs attention soon',
        pulse: '#fd7e14'
    },
    urgent: {
        label: 'Urgent',
        caption: 'Immediate action',
        pulse: '#dc3545'
    }
};

const PRIORITY_LABELS = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'urgent': 'Urgent'
};

function getPriorityLabel(priority) {
    return PRIORITY_LABELS[priority] || 'Medium';
}

function getPriorityBadge(priority) {
    const key = (priority || 'medium').toLowerCase();
    const detail = PRIORITY_DETAILS[key] || PRIORITY_DETAILS.medium;
    const label = detail.label;
    const caption = detail.caption;
    const color = detail.pulse;
    return `
        <span class="priority-pill priority-${key}" style="--priority-color:${color};">
            <span class="priority-pill__dot"></span>
            <span class="priority-pill__text">
                <strong>${label}</strong>
                <small>${caption}</small>
            </span>
        </span>
    `;
}

const PRIORITY_ORDER = {
    'urgent': 0,
    'high': 1,
    'medium': 2,
    'low': 3
};

function getPriorityRank(priority) {
    return PRIORITY_ORDER[priority] ?? 99;
}

function sortComplaintsByPriority(list = []) {
    return [...list].sort((a, b) => {
        const feedbackDiff = Number(needsFeedback(b)) - Number(needsFeedback(a));
        if (feedbackDiff !== 0) return feedbackDiff;
        const rankDiff = getPriorityRank(a?.priority) - getPriorityRank(b?.priority);
        if (rankDiff !== 0) return rankDiff;
        const aDate = new Date(a?.createdAt || 0).getTime();
        const bDate = new Date(b?.createdAt || 0).getTime();
        return bDate - aDate;
    });
}

function needsFeedback(complaint) {
    if (!complaint) return false;
    const status = (complaint.status || '').toLowerCase();
    const awaitingStatus = ['completed'];
    const hasFeedback = complaint.feedback && typeof complaint.feedback.rating === 'number' && complaint.feedback.rating >= 1;
    return (complaint.feedbackRequired || awaitingStatus.includes(status)) && !hasFeedback;
}

function redirectToRoleDashboard(role) {
    switch(role) {
        case 'student':
            window.location.href = '/student-dashboard.html';
            break;
        case 'staff': // Faculty role (kept as 'staff' for database compatibility)
            window.location.href = '/staff-dashboard.html';
            break;
        case 'admin':
            window.location.href = '/admin-dashboard.html';
            break;
        default:
            window.location.href = '/index.html';
    }
}

function initSectionNavigation(options = {}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const {
        menuSelector = '.sidebar .nav-item',
        activeClass = 'active',
        offset = 90,
        scrollContainerSelector = null
    } = options;

    const menuItems = Array.from(document.querySelectorAll(menuSelector));
    if (menuItems.length === 0) return;

    const requestedScrollContainer = scrollContainerSelector ? document.querySelector(scrollContainerSelector) : null;
    const scrollContainer = requestedScrollContainer || window;
    const isWindowScroll = scrollContainer === window || scrollContainer === document.body || scrollContainer === document.documentElement;

    const getSectionTop = (section) => {
        if (isWindowScroll) {
            return section.getBoundingClientRect().top + window.scrollY;
        }
        const containerRect = scrollContainer.getBoundingClientRect();
        const sectionRect = section.getBoundingClientRect();
        return sectionRect.top - containerRect.top + scrollContainer.scrollTop;
    };

    const scrollToPosition = (targetTop) => {
        if (isWindowScroll) {
            window.scrollTo({ top: Math.max(targetTop, 0), behavior: 'smooth' });
        } else {
            scrollContainer.scrollTo({ top: Math.max(targetTop, 0), behavior: 'smooth' });
        }
    };

    const sectionMeta = [];

    const setActive = (targetLink) => {
        sectionMeta.forEach(({ link }) => {
            link.classList.toggle(activeClass, link === targetLink);
        });
    };

    menuItems.forEach(link => {
        const targetRef = link.dataset.scrollTarget || link.getAttribute('href');
        if (!targetRef || !targetRef.startsWith('#')) return;
        const section = document.querySelector(targetRef);
        if (!section) return;

        sectionMeta.push({ link, section });

        link.addEventListener('click', (event) => {
            event.preventDefault();
            const top = getSectionTop(section) - offset;
            scrollToPosition(top);
            setActive(link);
        }, { passive: false });
    });

    if (!('IntersectionObserver' in window) || sectionMeta.length === 0) {
        if (sectionMeta.length) {
            setActive(sectionMeta[0].link);
        }
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const meta = sectionMeta.find(item => item.section === entry.target);
                if (meta) {
                    setActive(meta.link);
                }
            }
        });
    }, {
        root: isWindowScroll ? null : scrollContainer,
        threshold: 0.35,
        rootMargin: isWindowScroll ? '-30% 0px -40% 0px' : '0px 0px -40% 0px'
    });

    sectionMeta.forEach(({ section }) => observer.observe(section));
}

function formatPhoneNumber(value) {
    if (!value) return '';
    const digits = value.toString().replace(/\D/g, '');
    if (digits.length === 10) {
        return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
        return `+${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7)}`;
    }
    if (digits.length === 13 && digits.startsWith('091')) {
        return `+91 ${digits.slice(3, 8)} ${digits.slice(8)}`;
    }
    return value.toString();
}

function buildPhoneChipHtml(value) {
    const formatted = formatPhoneNumber(value);
    if (!formatted) return '—';
    const parts = formatted.split(' ').filter(Boolean);
    if (parts.length === 0) return '—';
    const code = parts.shift();
    const mainNumber = parts.join(' ') || code;
    return `
        <span class="phone-chip" title="${formatted}">
            <span class="phone-chip__code">${code}</span>
            <span class="phone-chip__number">${mainNumber}</span>
        </span>
    `;
}
