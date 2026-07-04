const galleryCache = {};
let currentActiveGallery = "";
let currentActiveAlbum = null;

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
    const target = document.getElementById(pageId);
    if (target) target.classList.remove('hidden');
    window.scrollTo(0, 0); 

    document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));
    const activeNavBtn = document.getElementById(`btn-nav-${pageId}`);
    if (activeNavBtn) activeNavBtn.classList.add('active');
}

function bookOrder(packageName) {
    const pkgInput = document.getElementById('cust-package');
    if (pkgInput) pkgInput.value = packageName;
    showPage('order');
}

async function adminAccess() {
    if (!supabaseClient) {
        showPage('login-page');
        return;
    }
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        showPage('admin-page');
        fetchOrders();
    } else {
        showPage('login-page');
    }
}

async function handleLogout() {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    showPage('home');
}

function closeModal() {
    document.getElementById('success-modal').classList.add('hidden');
    document.getElementById('order-form').reset(); 
    showPage('home'); 
}

function openLightbox(src) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    if(lightbox && lightboxImg) {
        lightbox.style.display = "flex";
        lightboxImg.src = src;
        lightboxImg.classList.remove('zoomed'); 
    }
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    if(lightbox) lightbox.style.display = "none";
    if(lightboxImg) lightboxImg.classList.remove('zoomed');
}

function toggleZoom() {
    const img = document.getElementById('lightbox-img');
    if(img) img.classList.toggle('zoomed');
}

let supabaseClient = null;
try {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(
            'https://wgbmcgsvoraioekuygux.supabase.co',
            'sb_publishable_qKPK_MqkYIhGi4PbFd5vhw_nMKWl5UX'
        );
    } else {
        console.warn("Supabase library not loaded yet.");
    }
} catch(err) {
    console.error("Supabase Init Error:", err);
}

async function openGallery(galleryName) {
    currentActiveGallery = galleryName;
    currentActiveAlbum = null;
    
    let formattedName = galleryName.replace(/_/g, ' ');
    formattedName = formattedName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    const titleEl = document.getElementById('gallery-title');
    if(titleEl) titleEl.innerText = formattedName;
    
    showPage('gallery-view');
    
    const imgContainer = document.getElementById('images-container');
    const albumContainer = document.getElementById('albums-container');
    if(!imgContainer || !albumContainer) return;
    
    imgContainer.innerHTML = "";
    albumContainer.innerHTML = "";
    albumContainer.classList.add('hidden');

    if(!supabaseClient) {
        imgContainer.innerHTML = "Database Connection Error. Please refresh.";
        return;
    }

    if (galleryCache[galleryName]) {
        renderGalleryData(galleryCache[galleryName], galleryName);
        return;
    }

    imgContainer.innerHTML = "<p style='text-align:center; width:100%; grid-column:1/-1;'>Loading Gallery... ⏳</p>";

    try {
        const { data, error } = await supabaseClient
            .storage
            .from('portfolio_images')
            .list(galleryName, { limit: 200 });

        if (error) throw error;

        let validFiles = data ? data.filter(f => f.name !== '.emptyFolderPlaceholder') : [];
        
        // ----------------------------------------------------
        // حل مشكلة الترتيب: ترتيب الملفات كأرقام وليس كنصوص
        // ----------------------------------------------------
        validFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        galleryCache[galleryName] = validFiles;
        renderGalleryData(validFiles, galleryName);

    } catch (err) {
        console.error("Gallery Loading Error:", err);
        imgContainer.innerHTML = "<p style='text-align:center; width:100%; color:red;'>Error loading images.</p>";
    }
}

function renderGalleryData(files, galleryName) {
    const imgContainer = document.getElementById('images-container');
    const albumContainer = document.getElementById('albums-container');
    
    imgContainer.innerHTML = "";
    albumContainer.innerHTML = "";
    
    if (files.length === 0) {
        imgContainer.innerHTML = "<p style='text-align: center; color: #888; width:100%; grid-column:1/-1;'>No content available yet.</p>";
        return;
    }

    const subFolders = files.filter(f => f.metadata === null || f.metadata === undefined); 
    const directImages = files.filter(f => f.metadata !== null && f.metadata !== undefined);

    if (subFolders.length > 0) {
        albumContainer.classList.remove('hidden');
        subFolders.forEach(folder => {
            const albumCard = document.createElement('div');
            albumCard.className = 'album-card';
            albumCard.onclick = () => openSubAlbum(galleryName, folder.name);
            const displayFolderName = folder.name.replace(/_/g, ' ');
            
            albumCard.innerHTML = `
                <div class="album-placeholder-bg" style="width:100%; height:100%; background:#222; display:flex; align-items:center; justify-content:center; color:var(--primary-color); font-weight:bold;">📸</div>
                <h3>${displayFolderName}</h3>
            `;
            albumContainer.appendChild(albumCard);
            loadAlbumCover(galleryName, folder.name, albumCard);
        });
    }

    if (directImages.length > 0) {
        directImages.forEach(file => {
            const filePath = galleryName + '/' + file.name;
            const { data: urlData } = supabaseClient.storage.from('portfolio_images').getPublicUrl(filePath);
            
            const img = document.createElement('img');
            img.src = urlData.publicUrl;
            img.alt = "Portfolio";
            img.loading = "lazy"; 
            img.onclick = () => openLightbox(urlData.publicUrl);
            imgContainer.appendChild(img);
        });
    }
}

async function loadAlbumCover(parentGallery, folderName, cardElement) {
    try {
        const { data, error } = await supabaseClient.storage.from('portfolio_images').list(`${parentGallery}/${folderName}`, { limit: 1 });
        if (!error && data && data.length > 0) {
            const firstImgPath = `${parentGallery}/${folderName}/${data[0].name}`;
            const { data: urlData } = supabaseClient.storage.from('portfolio_images').getPublicUrl(firstImgPath);
            cardElement.innerHTML = `
                <img src="${urlData.publicUrl}" alt="${folderName}" class="cover-img">
                <h3>${folderName.replace(/_/g, ' ')}</h3>
            `;
        }
    } catch(e) { console.error(e); }
}

async function openSubAlbum(parentGallery, folderName) {
    currentActiveAlbum = folderName;
    const titleEl = document.getElementById('gallery-title');
    if(titleEl) titleEl.innerText = folderName.replace(/_/g, ' ');

    const imgContainer = document.getElementById('images-container');
    const albumContainer = document.getElementById('albums-container');
    
    imgContainer.innerHTML = "<p style='text-align:center; width:100%; grid-column:1/-1;'>Loading Album Images... ⏳</p>";
    albumContainer.classList.add('hidden');

    const cacheKey = `${parentGallery}/${folderName}`;
    if (galleryCache[cacheKey]) {
        renderAlbumImages(galleryCache[cacheKey], cacheKey);
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .storage
            .from('portfolio_images')
            .list(`${parentGallery}/${folderName}`, { limit: 100 });

        if (error) throw error;
        
        let validFiles = data ? data.filter(f => f.name !== '.emptyFolderPlaceholder') : [];
        
        // ----------------------------------------------------
        // ترتيب الصور داخل الألبوم
        // ----------------------------------------------------
        validFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        galleryCache[cacheKey] = validFiles;
        renderAlbumImages(validFiles, cacheKey);
    } catch(err) {
        imgContainer.innerHTML = "<p style='text-align:center; color:red; width:100%;'>Error loading album images.</p>";
    }
}

function renderAlbumImages(files, cacheKey) {
    const imgContainer = document.getElementById('images-container');
    imgContainer.innerHTML = "";
    if(files.length === 0) {
        imgContainer.innerHTML = "<p style='text-align:center; width:100%; color:#888;'>This album is empty.</p>";
        return;
    }
    files.forEach(file => {
        const filePath = cacheKey + '/' + file.name;
        const { data: urlData } = supabaseClient.storage.from('portfolio_images').getPublicUrl(filePath);
        const img = document.createElement('img');
        img.src = urlData.publicUrl;
        img.alt = "Album Image";
        img.loading = "lazy";
        img.onclick = () => openLightbox(urlData.publicUrl);
        imgContainer.appendChild(img);
    });
}

function goBackGallery() {
    if (currentActiveAlbum) {
        openGallery(currentActiveGallery);
    } else {
        showPage('home');
    }
}

async function fetchOrders() {
    const tbody = document.querySelector('#admin-table tbody'); 
    if(!tbody || !supabaseClient) return;
    
    tbody.innerHTML = "<tr><td colspan='5'>Loading orders... ⏳</td></tr>";
    try {
        const { data, error } = await supabaseClient.from('orders').select('*').order('id', { ascending: false });
        if (error) throw error;
        
        tbody.innerHTML = "";
        if (data.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5'>No orders found.</td></tr>";
            return;
        }

        data.forEach(order => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${order.id}</td>
                <td>${order.client_name}</td>
                <td>${order.whatsapp}</td>
                <td>${order.package}</td>
                <td>
                    ${order.file_url ? `<a href="${order.file_url}" target="_blank" style="color: gold; text-decoration: none;">[View Test Img]</a>` : '-'}
                    ${order.drive_link && order.file_url ? ' | ' : ''}
                    ${order.drive_link ? `<a href="${order.drive_link}" target="_blank" style="color: #4CAF50; text-decoration: none;">[Google Drive]</a>` : '-'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(err) {
        tbody.innerHTML = "<tr><td colspan='5'>Error loading admin data.</td></tr>";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    showPage('home');

    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    if(lightbox) {
        lightbox.addEventListener('click', function(e) {
            if (e.target !== lightboxImg && e.target !== document.querySelector('.close-btn')) {
                closeLightbox();
            }
        });
    }

    const loginForm = document.getElementById('login-form');
    if(loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if(!supabaseClient) return alert("Database connection offline.");
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            const loginBtn = document.getElementById('login-btn');
            const originalText = loginBtn.innerText;
            
            loginBtn.innerText = "Signing in... ⏳";
            loginBtn.disabled = true;

            try {
                const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                showPage('admin-page');
                fetchOrders();
                loginForm.reset();
            } catch (error) {
                alert("Access Denied: " + error.message);
            } finally {
                loginBtn.innerText = originalText;
                loginBtn.disabled = false;
            }
        });
    }

    const formInputs = [document.getElementById('cust-name'), document.getElementById('cust-whatsapp'), document.getElementById('cust-page')];
    const inputDrive = document.getElementById('cust-drive');
    const inputFile = document.getElementById('cust-file');
    const sendBtn = document.getElementById('send-btn');
    const orderForm = document.getElementById('order-form');

    function checkFormValidity() {
        if(!sendBtn) return;
        const textsFilled = formInputs.every(input => input && input.value.trim() !== '');
        const hasMedia = (inputDrive && inputDrive.value.trim() !== '') || (inputFile && inputFile.files.length > 0);
        sendBtn.disabled = !(textsFilled && hasMedia);
    }

    formInputs.forEach(input => { if(input) input.addEventListener('input', checkFormValidity); });
    if(inputDrive) inputDrive.addEventListener('input', checkFormValidity);
    if(inputFile) inputFile.addEventListener('change', checkFormValidity);

    if(orderForm) {
        orderForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if(!supabaseClient) return alert("Database error. Try again later.");

            const originalText = sendBtn.innerText;
            sendBtn.innerText = "Submitting Order... ⏳";
            sendBtn.disabled = true;

            const name = document.getElementById('cust-name').value;
            const whatsapp = document.getElementById('cust-whatsapp').value;
            const pageLink = document.getElementById('cust-page').value;
            const packageSelected = document.getElementById('cust-package').value;
            const driveLink = document.getElementById('cust-drive').value;
            let fileUrl = ""; 

            try {
                if (inputFile && inputFile.files.length > 0) {
                    const file = inputFile.files[0];
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
                    const filePath = `test_images/${fileName}`;

                    const { error: uploadError } = await supabaseClient.storage.from('portfolio_images').upload(filePath, file);
                    if (uploadError) throw uploadError;

                    const { data: publicUrlData } = supabaseClient.storage.from('portfolio_images').getPublicUrl(filePath);
                    fileUrl = publicUrlData.publicUrl;
                }

                const { error } = await supabaseClient.from('orders').insert([{
                    client_name: name, whatsapp: whatsapp, page_link: pageLink,
                    package: packageSelected, drive_link: driveLink, file_url: fileUrl
                }]);

                if (error) throw error;

                // ==========================================
                // كود تليجرام المحدث 
                // ==========================================
                const botToken = "8852125005:AAEDWR75OyE9Y8vbQPMi1Xq2eXPkzWYHknI";
                const chatId = "2010636971";
                const telegramMsg = `🎉 طلب جديد في MBN ArtWork!\n\n👤 العميل: ${name}\n📞 واتساب: ${whatsapp}\n🔗 صفحة العميل: ${pageLink}\n📦 الباقة: ${packageSelected}\n📂 جوجل درايف: ${driveLink ? driveLink : 'لم يرفق'}\n🖼️ صورة الاختبار: ${fileUrl ? fileUrl : 'لم يرفق'}`;
                
                const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
                
                try {
                    const telRes = await fetch(telegramUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: chatId, text: telegramMsg })
                    });
                    const telData = await telRes.json();
                    if (!telData.ok) {
                        console.error("خطأ من تليجرام:", telData.description);
                    }
                } catch(err) {
                    console.error("فشل الاتصال بتليجرام:", err);
                }
                // ==========================================

                document.getElementById('success-modal').classList.remove('hidden');

            } catch (error) {
                alert("An error occurred. Please check your data and retry.");
            } finally {
                sendBtn.innerText = originalText;
                checkFormValidity();
            }
        });
    }

    let deferredPrompt;
    const installBanner = document.getElementById('pwa-install-banner');
    const installBtn = document.getElementById('pwa-install-btn');

    if (installBanner && installBtn) {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installBanner.style.display = 'flex';
        });

        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                await deferredPrompt.userChoice;
                deferredPrompt = null;
                installBanner.style.display = 'none';
            }
        });

        window.addEventListener('appinstalled', () => {
            installBanner.style.display = 'none';
            deferredPrompt = null;
        });
    }
});