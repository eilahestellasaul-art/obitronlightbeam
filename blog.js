/*
 * Lightbeam blog
 * Posts are GitHub Discussions in the "Blog" category of this repo.
 * The publish workflow (.github/workflows/pages.yml) turns them into posts.json.
 * Comments use giscus (https://giscus.app), which signs people in with GitHub.
 */
(function () {
  var CONFIG = {
    owner: 'eilahestellasaul-art',
    repo: 'obitronlightbeam',
    category: 'general' // fallback; posts.json says which Discussions category is in use
  };

  var repoUrl = 'https://github.com/' + CONFIG.owner + '/' + CONFIG.repo;
  var newPostUrl = repoUrl + '/discussions/new?category=' + CONFIG.category;
  function useCategory(data) {
    if (data && data.categorySlug) CONFIG.category = data.categorySlug;
    newPostUrl = repoUrl + '/discussions/new?category=' + CONFIG.category;
    document.querySelectorAll('[data-new-post]').forEach(function (a) { a.href = newPostUrl; });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
  }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function meta(p) {
    var a = p.author || {};
    return '<div class="post-meta">' +
      (a.avatar ? '<img src="' + esc(a.avatar) + '" alt="" loading="lazy">' : '') +
      '<span>' + esc(a.login || 'ghost') + '</span><span class="dot">•</span>' +
      '<time datetime="' + esc(p.createdAt) + '">' + fmtDate(p.createdAt) + '</time>' +
      '<span class="dot">•</span><span class="comment-count">' + plural(p.comments || 0, 'comment') + '</span>' +
      '</div>';
  }

  function loadPosts() {
    return fetch('posts.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function renderList() {
    var el = document.getElementById('posts');
    var write = document.getElementById('write-post');
    if (write) write.href = newPostUrl;

    loadPosts().then(function (data) {
      useCategory(data);
      var posts = (data && data.posts) || [];
      if (!posts.length) {
        el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>No posts yet</h3>' +
          '<p>Be the first to write one. Posts appear here a minute or two after they’re published.</p>' +
          '<a class="button" href="' + esc(newPostUrl) + '" target="_blank" rel="noopener">Write the first post</a></div>';
        return;
      }
      el.innerHTML = posts.map(function (p) {
        return '<a class="post-card" href="post.html?n=' + encodeURIComponent(p.number) + '">' +
          '<h3>' + esc(p.title) + '</h3>' +
          '<p>' + esc(p.excerpt) + '</p>' + meta(p) + '</a>';
      }).join('');
    }).catch(function () {
      el.innerHTML = '<div class="status-box" style="grid-column:1/-1"><h3>Couldn’t load posts</h3>' +
        '<p>Please refresh in a moment, or read them on GitHub.</p>' +
        '<a class="button ghost" href="' + esc(repoUrl) + '/discussions/categories/' + CONFIG.category +
        '" target="_blank" rel="noopener">Open on GitHub</a></div>';
    });
  }

  function mountGiscus(data, number) {
    var box = document.getElementById('comments');
    if (!data.repoId) return; // workflow hasn't run yet
    var s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    s.async = true;
    s.crossOrigin = 'anonymous';
    var attrs = {
      'data-repo': CONFIG.owner + '/' + CONFIG.repo,
      'data-repo-id': data.repoId,
      'data-mapping': 'number',
      'data-term': String(number),
      'data-strict': '0',
      'data-reactions-enabled': '1',
      'data-emit-metadata': '0',
      'data-input-position': 'top',
      'data-theme': 'transparent_dark',
      'data-lang': 'en',
      'data-loading': 'lazy'
    };
    if (data.categoryId) {
      attrs['data-category'] = data.categoryName || 'General';
      attrs['data-category-id'] = data.categoryId;
    }
    Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    document.getElementById('giscus').appendChild(s);
    box.hidden = false;
  }

  function renderPost() {
    var el = document.getElementById('post');
    var n = parseInt(new URLSearchParams(location.search).get('n'), 10);
    if (!n) { location.replace('blog.html'); return; }

    loadPosts().then(function (data) {
      useCategory(data);
      var p = ((data && data.posts) || []).filter(function (x) { return x.number === n; })[0];
      if (!p) {
        el.innerHTML = '<div class="status-box"><h3>This post isn’t here yet</h3>' +
          '<p>New and edited posts take a minute or two to publish. You can read it on GitHub in the meantime.</p>' +
          '<a class="button ghost" href="' + esc(repoUrl) + '/discussions/' + n + '" target="_blank" rel="noopener">Open on GitHub</a></div>';
        return;
      }
      document.title = p.title + ' | Obitron Lightbeam';
      // bodyHTML is rendered and sanitised by GitHub
      el.innerHTML = '<h1>' + esc(p.title) + '</h1>' + meta(p) +
        '<div class="post-body">' + p.html + '</div>' +
        '<div class="post-actions">' +
        '<a class="button ghost small" href="' + esc(p.url) + '" target="_blank" rel="noopener">View on GitHub</a>' +
        '<a class="button small" href="' + esc(newPostUrl) + '" target="_blank" rel="noopener">Write your own post</a>' +
        '</div>';
      mountGiscus(data, n);
    }).catch(function () {
      el.innerHTML = '<div class="status-box"><h3>Couldn’t load this post</h3><p>Please refresh in a moment.</p></div>';
    });
  }

  window.LightbeamBlog = { renderList: renderList, renderPost: renderPost };
})();
