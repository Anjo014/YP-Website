function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function toDriveImageUrl(url) {
  if (!url) return '';
  const match = url.match(/\/d\/([a-zA-Z0-9_-]{25,})/); // Google Drive file IDs are long
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  return url; // Return original URL if it's not a standard Drive link
}

async function loadAnnouncements() {
  const list = document.getElementById('announcementsList');
  const eventsList = document.getElementById('upcomingEventsList');
  try {
    const items = await Api.get('getAnnouncements');
    const today = new Date().toISOString().slice(0, 10);

    const upcomingEvents = items.filter(a => a.eventDate && a.eventDate >= today);
    const generalAnnouncements = items.filter(a => !a.eventDate || a.eventDate < today);

    if (upcomingEvents.length) {
      eventsList.innerHTML = upcomingEvents.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate)).map(a => `
        <li class="bulletin-item">
          <div class="meta" style="font-weight:600; color:var(--ember-dark);">EVENT ON: ${formatDate(a.eventDate)}</div>
          <h3>${escapeHtml(a.title)}</h3>
          <p>${escapeHtml(a.content)}</p>
        </li>
      `).join('');
    } else {
      eventsList.innerHTML = '<li class="empty-state">No upcoming events right now.</li>';
    }

    if (generalAnnouncements.length) {
      list.innerHTML = generalAnnouncements.map(a => `
      <li class="bulletin-item">
        <div class="meta">${formatDate(a.date)} &middot; posted by ${escapeHtml(a.postedBy)}</div>
        <h3>${escapeHtml(a.title)}</h3>
        <p>${escapeHtml(a.content)}</p>
      </li>
    `).join('');
    } else {
      list.innerHTML = '<li class="empty-state">No general announcements right now.</li>';
    }

  } catch (err) {
    list.innerHTML = `<li class="empty-state">Couldn't load announcements: ${escapeHtml(err.message)}</li>`;
    eventsList.innerHTML = `<li class="empty-state">Couldn't load events: ${escapeHtml(err.message)}</li>`;
  }
}

function createCarousel(carouselId, trackId, speed = 40) {
  const track = document.getElementById(trackId);
  if (!track || track.children.length <= 1) return;

  // Duplicate slides for seamless looping
  const slides = Array.from(track.children);
  slides.forEach(slide => track.appendChild(slide.cloneNode(true)));

  // Create dynamic animation
  const totalWidth = Array.from(track.children).reduce((w, s) => w + s.offsetWidth, 0) / 2;
  const duration = totalWidth / speed; // speed in pixels per second

  const keyframes = `
    @keyframes scroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-${totalWidth}px); }
    }`;

  const styleSheet = document.createElement("style");
  styleSheet.innerText = keyframes;
  document.head.appendChild(styleSheet);

  track.style.animation = `scroll ${duration}s linear infinite`;
}

async function loadGallery() {
  const grid = document.getElementById('galleryGrid');
  try {
    const items = await Api.get('getPhotos');
    if (!items.length) {
      grid.innerHTML = '<div class="empty-state">No photos yet — check back soon.</div>';
      return;
    }
    grid.innerHTML = items.map(p => `
      <div class="gallery-card">
        <img src="${toDriveImageUrl(p.url)}" alt="${escapeHtml(p.caption || 'Gathering photo')}" loading="lazy">
        ${p.caption ? `<div class="cap">${escapeHtml(p.caption)}</div>` : ''}
      </div>
    `).join('');
    createCarousel('galleryCarousel', 'galleryGrid');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Couldn't load photos: ${escapeHtml(err.message)}</div>`;
  }
}

/* ---------------- Photo Lightbox ---------------- */

const photoModal = {
  overlay: document.getElementById('photoModalOverlay'),
  image: document.getElementById('photoModalImage'),
  caption: document.getElementById('photoModalCaption'),
  open(src, alt) {
    this.image.src = src;
    this.image.alt = alt;
    this.caption.textContent = alt;
    this.overlay.classList.add('open');
  },
  close() {
    this.overlay.classList.remove('open');
  }
};

document.getElementById('galleryGrid').addEventListener('click', (e) => {
  if (e.target.tagName === 'IMG') photoModal.open(e.target.src, e.target.alt);
});

photoModal.overlay.addEventListener('click', () => photoModal.close());

/* ---------------- Auto-Sync Polling ---------------- */
let lastUpdateTimestamp = '0';

async function checkForUpdates() {
  try {
    const status = await Api.get('getUpdateStatus', { silent: true });
    if (status.lastUpdate && status.lastUpdate !== lastUpdateTimestamp) {
      console.log('Changes detected, reloading data...');
      lastUpdateTimestamp = status.lastUpdate;
      // Reload all data for the public page
      await loadAnnouncements();
      await loadGallery();
    }
  } catch (err) {
    console.error('Error checking for updates:', err);
  }
}

async function initMainPage() {
  const status = await Api.get('getUpdateStatus', { silent: true });
  lastUpdateTimestamp = status.lastUpdate || '0';
  await Promise.all([loadAnnouncements(), loadGallery()]);
  setInterval(checkForUpdates, 10000); // Check for updates every 10 seconds
}

initMainPage();
