/**
 * ============================================================
 *  RK PREMIUM E-COMMERCE — ADMIN DASHBOARD
 *  admin.js — Full CRUD: Add, Edit, Delete Products & Users
 *
 *  DEPENDENCIES (must be loaded before this file):
 *    1. Firebase SDK (app-compat, auth, firestore, database)
 *    2. config.js  → window.RK_ADMIN_EMAIL
 *    3. index.html → fbDB, fbRTDB, fbAuth, currentUser, products, showToast
 * ============================================================
 */

'use strict';

// ── Admin Guard ───────────────────────────────────────────────────────────────
const ADMIN_EMAILS = [window.RK_ADMIN_EMAIL].filter(Boolean);
function isAdminUser(u) { return u && ADMIN_EMAILS.includes(u.email); }

// ── State ─────────────────────────────────────────────────────────────────────
let _adminOrders        = [];
let _adminUsers         = [];
let _adminOrderFilter   = 'all';
let _adminOrderSearch   = '';
let _adminUserSearch    = '';
let _adminProductSearch = '';

// ── Load Dashboard ────────────────────────────────────────────────────────────
async function loadAdminDashboard() {
    if (!currentUser || !isAdminUser(currentUser)) {
        showToast('<i class="ph ph-shield-slash" style="color:var(--danger)"></i> Admin access denied.');
        return;
    }
    switchAdminTab('overview');
    const el = document.getElementById('admin-last-updated');
    if (el) el.textContent = 'Last updated: ' + new Date().toLocaleString('en-IN');

    try {
        const [ordersSnap, usersSnap] = await Promise.all([
            fbDB.collection('all_orders').orderBy('createdAt', 'desc').limit(200).get(),
            fbDB.collection('users').limit(200).get()
        ]);
        _adminOrders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        _adminUsers  = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        renderAdminStats();
        renderAdminRecentOrders();
        renderAdminAllOrders();
        renderAdminUsers();
        renderAdminProducts();
    } catch (e) {
        console.error('[Admin] Load error:', e);
        showToast('<i class="ph ph-warning" style="color:var(--danger)"></i> Load failed: ' + e.message);
    }
}

// ── Stats & Chart ─────────────────────────────────────────────────────────────
function renderAdminStats() {
    const totalRevenue = _adminOrders.reduce((s, o) => s + (o.total || 0), 0);
    _setEl('astat-revenue',  '$' + totalRevenue.toFixed(2));
    _setEl('astat-orders',   _adminOrders.length);
    _setEl('astat-users',    _adminUsers.length);
    _setEl('astat-products', typeof products !== 'undefined' ? products.length : '—');
    const badge = document.getElementById('admin-orders-badge');
    if (badge) badge.textContent = _adminOrders.length;

    const now = new Date(), months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ label: d.toLocaleString('default', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() });
    }
    const monthRevs = months.map(m =>
        _adminOrders.filter(o => { const d = new Date(o.createdAt); return d.getFullYear() === m.year && d.getMonth() === m.month; })
            .reduce((s, o) => s + (o.total || 0), 0)
    );
    const maxRev = Math.max(...monthRevs, 1);
    const chartEl = document.getElementById('revenue-chart-bars');
    if (chartEl) {
        chartEl.innerHTML = months.map((m, i) => `
            <div class="chart-bar-wrap">
                <div class="chart-bar" style="height:${(monthRevs[i]/maxRev)*100}%;" title="${m.label}: $${monthRevs[i].toFixed(2)}"></div>
                <div class="chart-bar-label">${m.label}</div>
            </div>`).join('');
    }
    _setEl('chart-total-rev', '$' + totalRevenue.toFixed(2));
}

// ── Orders ────────────────────────────────────────────────────────────────────
function _buildOrderRow(order, showAddress = false) {
    const date   = new Date(order.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    const status = order.status || 'confirmed';
    const addrCell = showAddress
        ? `<td style="font-size:0.75rem;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${order.address||''}">${(order.address||'N/A').substring(0,28)}</td>`
        : '';
    return `<tr>
        <td style="font-weight:600;font-size:0.8rem;">#${(order.id||'').substring(0,10).toUpperCase()}</td>
        <td>
            <div style="font-weight:600;font-size:0.83rem;">${order.userName||'Customer'}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);">${order.userEmail||''}</div>
        </td>
        <td style="font-size:0.8rem;">${(order.items||[]).length} items</td>
        <td style="font-weight:700;color:var(--accent);">$${(order.total||0).toFixed(2)}</td>
        <td style="font-size:0.78rem;">${order.paymentMethod||'Card'}</td>
        ${addrCell}
        <td>
            <select class="admin-status-select" onchange="adminUpdateOrderStatus('${order.id}',this.value)">
                <option value="confirmed"  ${status==='confirmed'  ?'selected':''}>Confirmed</option>
                <option value="processing" ${status==='processing' ?'selected':''}>Processing</option>
                <option value="delivered"  ${status==='delivered'  ?'selected':''}>Delivered</option>
                <option value="cancelled"  ${status==='cancelled'  ?'selected':''}>Cancelled</option>
            </select>
        </td>
        <td style="font-size:0.78rem;color:var(--text-muted);">${date}</td>
    </tr>`;
}

function renderAdminRecentOrders() {
    const body = document.getElementById('admin-recent-orders-body');
    if (!body) return;
    const recent = _adminOrders.slice(0, 8);
    body.innerHTML = recent.length
        ? recent.map(o => _buildOrderRow(o, false)).join('')
        : '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No orders yet.</td></tr>';
}

function renderAdminAllOrders() {
    const body = document.getElementById('admin-all-orders-body');
    if (!body) return;
    let orders = _adminOrders;
    if (_adminOrderFilter !== 'all') orders = orders.filter(o => (o.status||'confirmed') === _adminOrderFilter);
    if (_adminOrderSearch) orders = orders.filter(o =>
        (o.id||'').toLowerCase().includes(_adminOrderSearch) ||
        (o.userEmail||'').toLowerCase().includes(_adminOrderSearch) ||
        (o.userName||'').toLowerCase().includes(_adminOrderSearch)
    );
    body.innerHTML = orders.length
        ? orders.map(o => _buildOrderRow(o, true)).join('')
        : '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted);">No orders found.</td></tr>';
}

function adminFilterOrders(btn, filter) {
    document.querySelectorAll('#adminpanel-orders .admin-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _adminOrderFilter = filter;
    renderAdminAllOrders();
}
function adminSearchOrders(q) { _adminOrderSearch = q.toLowerCase(); renderAdminAllOrders(); }

async function adminUpdateOrderStatus(orderId, newStatus) {
    try {
        await fbDB.collection('all_orders').doc(orderId).update({ status: newStatus });
        const o = _adminOrders.find(x => x.id === orderId);
        if (o) o.status = newStatus;
        showToast('<i class="ph ph-check-circle" style="color:var(--success)"></i> Order updated to ' + newStatus);
    } catch (e) {
        showToast('<i class="ph ph-warning" style="color:var(--danger)"></i> Update failed: ' + e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════
// ── USERS CRUD ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

function renderAdminUsers() {
    const body = document.getElementById('admin-users-body');
    if (!body) return;
    let users = _adminUsers;
    if (_adminUserSearch) users = users.filter(u =>
        (u.name||'').toLowerCase().includes(_adminUserSearch) ||
        (u.email||'').toLowerCase().includes(_adminUserSearch) ||
        (u.mobile||'').includes(_adminUserSearch)
    );
    if (!users.length) {
        body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted);">No users found.</td></tr>';
        return;
    }
    body.innerHTML = users.map(u => {
        const name     = u.name || u.email || 'Unknown';
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const since    = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { month:'short', year:'numeric' }) : '—';
        const isAdmin  = ADMIN_EMAILS.includes(u.email);
        const userId   = u.id;
        return `<tr>
            <td>
                <div style="display:flex;align-items:center;gap:0.7rem;">
                    <div class="admin-user-avatar">${initials}</div>
                    <div>
                        <span style="font-weight:600;font-size:0.85rem;">${name}</span>
                        ${isAdmin ? '<span style="font-size:0.68rem;background:var(--accent);color:#000;padding:1px 6px;border-radius:20px;margin-left:6px;font-weight:700;">ADMIN</span>' : ''}
                    </div>
                </div>
            </td>
            <td style="font-size:0.82rem;">${u.email||'—'}</td>
            <td style="font-size:0.82rem;">${u.mobile||'—'}</td>
            <td style="font-size:0.82rem;">${u.gender||'—'}</td>
            <td style="font-size:0.82rem;">${[u.city,u.state].filter(Boolean).join(', ')||'—'}</td>
            <td style="font-size:0.82rem;">${u.pin||'—'}</td>
            <td style="font-size:0.78rem;color:var(--text-muted);">${since}</td>
            <td>
                <div class="admin-action-btns">
                    <button class="admin-action-btn edit" onclick="adminOpenEditUser('${userId}')">
                        <i class="ph ph-pencil"></i> Edit
                    </button>
                    ${!isAdmin ? `<button class="admin-action-btn delete" onclick="adminDeleteUser('${userId}','${name.replace(/'/g,'\\&apos;')}')">
                        <i class="ph ph-trash"></i> Del
                    </button>` : '<span style="font-size:0.7rem;color:var(--text-muted);">Protected</span>'}
                </div>
            </td>
        </tr>`;
    }).join('');
}

function adminSearchUsers(q) { _adminUserSearch = q.toLowerCase(); renderAdminUsers(); }

// Open Add User modal
function adminOpenAddUser() {
    document.getElementById('admin-user-modal-title').textContent = 'Add New User';
    document.getElementById('aum-save-btn').textContent = '  Save User';
    document.getElementById('aum-id').value = '';
    document.getElementById('aum-name').value = '';
    document.getElementById('aum-email').value = '';
    document.getElementById('aum-mobile').value = '';
    document.getElementById('aum-gender').value = '';
    document.getElementById('aum-city').value = '';
    document.getElementById('aum-state').value = '';
    document.getElementById('aum-address').value = '';
    document.getElementById('aum-pin').value = '';
    document.getElementById('aum-password').value = '';
    document.getElementById('aum-email').readOnly = false;
    document.getElementById('aum-password-wrap').style.display = 'flex';
    document.getElementById('aum-note').style.display = 'block';
    document.getElementById('admin-user-modal-overlay').classList.add('open');
}

// Open Edit User modal
function adminOpenEditUser(userId) {
    const u = _adminUsers.find(x => x.id === userId);
    if (!u) return;
    document.getElementById('admin-user-modal-title').textContent = 'Edit User';
    document.getElementById('aum-save-btn').innerHTML = '<i class="ph ph-floppy-disk"></i> Update User';
    document.getElementById('aum-id').value    = u.id;
    document.getElementById('aum-name').value  = u.name || '';
    document.getElementById('aum-email').value = u.email || '';
    document.getElementById('aum-email').readOnly = true; // can't change email
    document.getElementById('aum-mobile').value  = u.mobile || '';
    document.getElementById('aum-gender').value  = u.gender || '';
    document.getElementById('aum-city').value    = u.city || '';
    document.getElementById('aum-state').value   = u.state || '';
    document.getElementById('aum-address').value = u.address || '';
    document.getElementById('aum-pin').value     = u.pin || '';
    document.getElementById('aum-password-wrap').style.display = 'none';
    document.getElementById('aum-note').style.display = 'none';
    document.getElementById('admin-user-modal-overlay').classList.add('open');
}

function adminCloseUserModal() {
    document.getElementById('admin-user-modal-overlay').classList.remove('open');
}

// Save (Add or Update) User
async function adminSaveUser() {
    const userId   = document.getElementById('aum-id').value.trim();
    const name     = document.getElementById('aum-name').value.trim();
    const email    = document.getElementById('aum-email').value.trim();
    const password = document.getElementById('aum-password').value;
    const isEditing = !!userId;

    if (!name) { showToast('<i class="ph ph-warning" style="color:var(--danger)"></i> Name is required.'); return; }
    if (!email) { showToast('<i class="ph ph-warning" style="color:var(--danger)"></i> Email is required.'); return; }
    if (!isEditing && password.length < 6) { showToast('<i class="ph ph-warning" style="color:var(--danger)"></i> Password must be at least 6 characters.'); return; }

    const btn = document.getElementById('aum-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner"></i> Saving...';

    const userData = {
        name,
        email,
        mobile:  document.getElementById('aum-mobile').value.trim(),
        gender:  document.getElementById('aum-gender').value,
        city:    document.getElementById('aum-city').value.trim(),
        state:   document.getElementById('aum-state').value.trim(),
        address: document.getElementById('aum-address').value.trim(),
        pin:     document.getElementById('aum-pin').value.trim(),
        updatedAt: new Date().toISOString()
    };

    try {
        if (isEditing) {
            // Update Firestore doc only (email/auth cannot change here without re-login)
            await fbDB.collection('users').doc(userId).update(userData);
            const idx = _adminUsers.findIndex(u => u.id === userId);
            if (idx > -1) _adminUsers[idx] = { ..._adminUsers[idx], ...userData };
            showToast('<i class="ph ph-check-circle" style="color:var(--success)"></i> User updated successfully!');
        } else {
            // Create Firebase Auth account + Firestore doc
            userData.createdAt = new Date().toISOString();
            // Use a secondary auth instance trick to avoid logging out current admin
            const secondaryApp = firebase.initializeApp(window.RK_FIREBASE_CONFIG, 'secondary_' + Date.now());
            const secondaryAuth = secondaryApp.auth();
            const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
            await cred.user.updateProfile({ displayName: name });
            const newUid = cred.user.uid;
            await fbDB.collection('users').doc(newUid).set({ ...userData, uid: newUid });
            await secondaryAuth.signOut();
            await secondaryApp.delete();
            const newUser = { id: newUid, ...userData };
            _adminUsers.unshift(newUser);
            _setEl('astat-users', _adminUsers.length);
            showToast('<i class="ph ph-check-circle" style="color:var(--success)"></i> User created successfully!');
        }
        renderAdminUsers();
        adminCloseUserModal();
    } catch (e) {
        console.error('[Admin] Save user error:', e);
        showToast('<i class="ph ph-warning" style="color:var(--danger)"></i> Error: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-floppy-disk"></i> Save User';
    }
}

// Delete User
function adminDeleteUser(userId, userName) {
    _adminShowConfirm(
        `Are you sure you want to delete <strong>${userName}</strong>? Their profile data will be removed from Firestore. (Firebase Auth account must be deleted separately via Firebase Console.)`,
        async () => {
            try {
                await fbDB.collection('users').doc(userId).delete();
                _adminUsers = _adminUsers.filter(u => u.id !== userId);
                renderAdminUsers();
                _setEl('astat-users', _adminUsers.length);
                showToast('<i class="ph ph-check-circle" style="color:var(--success)"></i> User deleted.');
            } catch (e) {
                showToast('<i class="ph ph-warning" style="color:var(--danger)"></i> Delete failed: ' + e.message);
            }
        }
    );
}

// ═══════════════════════════════════════════════════════════════════
// ── PRODUCTS CRUD ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

function renderAdminProducts() { adminFilterProducts(); }

function adminFilterProducts() {
    const body   = document.getElementById('admin-products-body');
    if (!body) return;
    const catSel = document.getElementById('admin-cat-filter');
    const cat    = catSel ? catSel.value : 'all';
    let prods    = typeof products !== 'undefined' ? products : [];
    if (cat && cat !== 'all') prods = prods.filter(p => p.category === cat);
    if (_adminProductSearch) prods = prods.filter(p =>
        p.name.toLowerCase().includes(_adminProductSearch) ||
        p.category.toLowerCase().includes(_adminProductSearch)
    );
    const badgeColors = { hot:'#ef4444', new:'#4caf50', limited:'#fbbf24', sale:'#6366f1' };
    body.innerHTML = prods.map(p => {
        const badgeEl = p.badge
            ? `<span style="font-size:0.7rem;padding:2px 8px;border-radius:20px;background:${badgeColors[p.badge]||'#888'}22;color:${badgeColors[p.badge]||'#888'};border:1px solid ${badgeColors[p.badge]||'#888'}44;font-weight:700;text-transform:uppercase;">${p.badge}</span>`
            : '<span style="color:var(--text-muted);font-size:0.75rem;">—</span>';
        return `<tr>
            <td>
                <div style="display:flex;align-items:center;gap:0.8rem;">
                    <img src="${p.image}" alt="${p.name}" class="admin-product-img" loading="lazy">
                    <span style="font-weight:600;font-size:0.83rem;">${p.name}</span>
                </div>
            </td>
            <td style="font-size:0.82rem;">${p.category}</td>
            <td style="font-weight:600;">$${p.price}</td>
            <td style="color:var(--success);font-weight:600;">${p.salePrice ? '$' + p.salePrice : '—'}</td>
            <td style="font-size:0.82rem;">⭐ ${p.rating}</td>
            <td>${badgeEl}</td>
            <td>
                <div class="admin-action-btns">
                    <button class="admin-action-btn edit" onclick="adminOpenEditProduct(${p.id})">
                        <i class="ph ph-pencil"></i> Edit
                    </button>
                    <button class="admin-action-btn delete" onclick="adminDeleteProduct(${p.id},'${p.name.replace(/'/g,'\\&apos;')}')">
                        <i class="ph ph-trash"></i> Del
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function adminSearchProducts(q) { _adminProductSearch = q.toLowerCase(); adminFilterProducts(); }

// Open Add Product modal
function adminOpenAddProduct() {
    document.getElementById('admin-product-modal-title').textContent = 'Add New Product';
    document.getElementById('apm-save-btn').innerHTML = '<i class="ph ph-floppy-disk"></i> Save Product';
    document.getElementById('apm-id').value       = '';
    document.getElementById('apm-name').value     = '';
    document.getElementById('apm-category').value = '';
    document.getElementById('apm-badge').value    = '';
    document.getElementById('apm-price').value    = '';
    document.getElementById('apm-sale-price').value = '';
    document.getElementById('apm-rating').value   = '4.5';
    document.getElementById('apm-reviews').value  = '0';
    document.getElementById('apm-image').value    = '';
    document.getElementById('apm-desc').value     = '';
    document.getElementById('apm-isnew').checked  = false;
    document.getElementById('admin-product-modal-overlay').classList.add('open');
}

// Open Edit Product modal
function adminOpenEditProduct(productId) {
    const p = typeof products !== 'undefined' ? products.find(x => x.id === productId) : null;
    if (!p) return;
    document.getElementById('admin-product-modal-title').textContent = 'Edit Product';
    document.getElementById('apm-save-btn').innerHTML = '<i class="ph ph-floppy-disk"></i> Update Product';
    document.getElementById('apm-id').value         = p.id;
    document.getElementById('apm-name').value       = p.name;
    document.getElementById('apm-category').value   = p.category;
    document.getElementById('apm-badge').value      = p.badge || '';
    document.getElementById('apm-price').value      = p.price;
    document.getElementById('apm-sale-price').value = p.salePrice || '';
    document.getElementById('apm-rating').value     = p.rating;
    document.getElementById('apm-reviews').value    = p.reviews;
    document.getElementById('apm-image').value      = p.image;
    document.getElementById('apm-desc').value       = p.desc;
    document.getElementById('apm-isnew').checked    = !!p.isNew;
    document.getElementById('admin-product-modal-overlay').classList.add('open');
}

function adminCloseProductModal() {
    document.getElementById('admin-product-modal-overlay').classList.remove('open');
}

// Save (Add or Update) Product
async function adminSaveProduct() {
    const pid      = document.getElementById('apm-id').value;
    const name     = document.getElementById('apm-name').value.trim();
    const category = document.getElementById('apm-category').value;
    const price    = parseFloat(document.getElementById('apm-price').value);
    const image    = document.getElementById('apm-image').value.trim();
    const desc     = document.getElementById('apm-desc').value.trim();
    const isEditing = !!pid;

    if (!name)     { showToast('<i class="ph ph-warning" style="color:var(--danger)"></i> Product name is required.'); return; }
    if (!category) { showToast('<i class="ph ph-warning" style="color:var(--danger)"></i> Category is required.'); return; }
    if (isNaN(price) || price <= 0) { showToast('<i class="ph ph-warning" style="color:var(--danger)"></i> Valid price is required.'); return; }
    if (!image)    { showToast('<i class="ph ph-warning" style="color:var(--danger)"></i> Image URL is required.'); return; }
    if (!desc)     { showToast('<i class="ph ph-warning" style="color:var(--danger)"></i> Description is required.'); return; }

    const btn = document.getElementById('apm-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner"></i> Saving...';

    const salePriceRaw = parseFloat(document.getElementById('apm-sale-price').value);
    const productData = {
        name,
        category,
        price,
        salePrice:  isNaN(salePriceRaw) ? null : salePriceRaw,
        badge:      document.getElementById('apm-badge').value || null,
        rating:     parseFloat(document.getElementById('apm-rating').value) || 4.5,
        reviews:    parseInt(document.getElementById('apm-reviews').value) || 0,
        image,
        desc,
        isNew:      document.getElementById('apm-isnew').checked,
        sizes:      ['One Size'],
        colors:     ['#1a1a1a', '#f5f5f5'],
        tags:       [],
    };

    try {
        if (isEditing) {
            // Update the local products array
            const idx = products.findIndex(p => String(p.id) === String(pid));
            if (idx > -1) {
                products[idx] = { ...products[idx], ...productData };
                renderAdminProducts();
                _setEl('astat-products', products.length);
                showToast('<i class="ph ph-check-circle" style="color:var(--success)"></i> Product updated!');
            }
            // Also save to Firestore for persistence
            await fbDB.collection('products').doc(String(pid)).set({ ...productData, id: parseInt(pid) }, { merge: true });
        } else {
            // Generate new ID (max existing + 1)
            const newId = (typeof products !== 'undefined' && products.length)
                ? Math.max(...products.map(p => p.id)) + 1
                : 1;
            const newProduct = { id: newId, ...productData };
            // Add to local array
            if (typeof products !== 'undefined') {
                products.push(newProduct);
            }
            // Save to Firestore
            await fbDB.collection('products').doc(String(newId)).set(newProduct);
            renderAdminProducts();
            _setEl('astat-products', products.length);
            showToast('<i class="ph ph-check-circle" style="color:var(--success)"></i> Product added to store!');
        }
        adminCloseProductModal();
    } catch (e) {
        console.error('[Admin] Save product error:', e);
        // Even if Firestore fails, local update was successful
        showToast('<i class="ph ph-warning" style="color:#fbbf24)"></i> Saved locally. Firestore sync: ' + e.message);
        adminCloseProductModal();
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-floppy-disk"></i> Save Product';
    }
}

// Delete Product
function adminDeleteProduct(productId, productName) {
    _adminShowConfirm(
        `Are you sure you want to delete <strong>${productName}</strong>? This will remove it from the store immediately.`,
        async () => {
            try {
                if (typeof products !== 'undefined') {
                    const idx = products.findIndex(p => p.id === productId);
                    if (idx > -1) products.splice(idx, 1);
                }
                await fbDB.collection('products').doc(String(productId)).delete().catch(() => {});
                renderAdminProducts();
                _setEl('astat-products', typeof products !== 'undefined' ? products.length : '—');
                showToast('<i class="ph ph-check-circle" style="color:var(--success)"></i> Product deleted.');
            } catch (e) {
                showToast('<i class="ph ph-warning" style="color:var(--danger)"></i> Error: ' + e.message);
            }
        }
    );
}

// ── Tab Switcher ──────────────────────────────────────────────────────────────
function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
    const panel = document.getElementById('adminpanel-' + tab);
    const btn   = document.getElementById('admin-tab-' + tab);
    if (panel) panel.classList.add('active');
    if (btn)   btn.classList.add('active');
}

// ── Confirm Dialog Helper ─────────────────────────────────────────────────────
function _adminShowConfirm(msg, onConfirm) {
    document.getElementById('admin-confirm-msg').innerHTML = msg;
    const overlay = document.getElementById('admin-confirm-modal-overlay');
    const confirmBtn = document.getElementById('admin-confirm-btn');
    overlay.classList.add('open');
    // Remove previous listeners
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.addEventListener('click', async () => {
        adminCloseConfirm();
        await onConfirm();
    });
}

function adminCloseConfirm() {
    document.getElementById('admin-confirm-modal-overlay').classList.remove('open');
}

// ── CSV Exports ───────────────────────────────────────────────────────────────
function adminExportOrdersCSV() {
    if (!_adminOrders.length) { showToast('<i class="ph ph-warning" style="color:var(--danger)"></i> No orders to export.'); return; }
    const headers = ['Order ID','Customer','Email','Items','Total','Payment','Status','Date'];
    const rows = _adminOrders.map(o => [
        (o.id||'').substring(0,12).toUpperCase(), o.userName||'Customer', o.userEmail||'',
        (o.items||[]).length, '$'+(o.total||0).toFixed(2), o.paymentMethod||'Card',
        o.status||'confirmed', new Date(o.createdAt).toLocaleDateString('en-IN'),
    ]);
    _downloadCSV([headers,...rows], 'rk-orders');
    showToast('<i class="ph ph-file-csv" style="color:var(--success)"></i> Orders exported!');
}

function adminExportUsersCSV() {
    if (!_adminUsers.length) { showToast('<i class="ph ph-warning" style="color:var(--danger)"></i> No users to export.'); return; }
    const headers = ['Name','Email','Mobile','Gender','City','State','PIN','Joined'];
    const rows = _adminUsers.map(u => [
        u.name||'', u.email||'', u.mobile||'', u.gender||'',
        u.city||'', u.state||'', u.pin||'',
        u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '',
    ]);
    _downloadCSV([headers,...rows], 'rk-users');
    showToast('<i class="ph ph-file-csv" style="color:var(--success)"></i> Users exported!');
}

function _downloadCSV(rows, filename) {
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _setEl(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }

// ── Escape key closes modals ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        adminCloseProductModal();
        adminCloseUserModal();
        adminCloseConfirm();
    }
});

// ── Global Exports ────────────────────────────────────────────────────────────
window.loadAdminDashboard      = loadAdminDashboard;
window.switchAdminTab          = switchAdminTab;
window.isAdminUser             = isAdminUser;

// Orders
window.adminFilterOrders       = adminFilterOrders;
window.adminSearchOrders       = adminSearchOrders;
window.adminUpdateOrderStatus  = adminUpdateOrderStatus;
window.updateAdminOrderStatus  = adminUpdateOrderStatus;
window.adminExportOrdersCSV    = adminExportOrdersCSV;

// Users
window.adminSearchUsers        = adminSearchUsers;
window.adminOpenAddUser        = adminOpenAddUser;
window.adminOpenEditUser       = adminOpenEditUser;
window.adminCloseUserModal     = adminCloseUserModal;
window.adminSaveUser           = adminSaveUser;
window.adminDeleteUser         = adminDeleteUser;
window.adminExportUsersCSV     = adminExportUsersCSV;

// Products
window.adminFilterProducts     = adminFilterProducts;
window.adminSearchProducts     = adminSearchProducts;
window.adminOpenAddProduct     = adminOpenAddProduct;
window.adminOpenEditProduct    = adminOpenEditProduct;
window.adminCloseProductModal  = adminCloseProductModal;
window.adminSaveProduct        = adminSaveProduct;
window.adminDeleteProduct      = adminDeleteProduct;

// Confirm dialog
window.adminCloseConfirm       = adminCloseConfirm;

console.log('[RK Admin] admin.js loaded ✓ | Admin:', ADMIN_EMAILS);
