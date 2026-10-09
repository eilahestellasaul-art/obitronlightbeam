// Builds posts.json from the repo's GitHub Discussions in the blog category.
// Run by .github/workflows/pages.yml. Needs GITHUB_TOKEN and GITHUB_REPOSITORY.
import { writeFile } from 'node:fs/promises';

const token = process.env.GITHUB_TOKEN;
const [owner, name] = (process.env.GITHUB_REPOSITORY || '').split('/');
// First category slug that exists wins, e.g. "blog,general"
const categorySlugs = (process.env.BLOG_CATEGORY || 'blog,general').split(',').map(s => s.trim()).filter(Boolean);
let categorySlug = categorySlugs[0];
const out = process.env.OUT_FILE || 'posts.json';

if (!token || !owner || !name) {
  console.error('GITHUB_TOKEN and GITHUB_REPOSITORY are required');
  process.exit(1);
}

const query = `
query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    id
    hasDiscussionsEnabled
    discussionCategories(first: 50) { nodes { id name slug } }
    discussions(first: 50, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title bodyHTML bodyText createdAt updatedAt url
        author { login url avatarUrl(size: 64) }
        category { slug }
        comments { totalCount }
      }
    }
  }
}`;

async function gql(variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors || json));
  return json.data.repository;
}

function excerpt(text, max = 180) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, '') + '…' : t;
}

const result = { repo: `${owner}/${name}`, repoId: null, categoryId: null, categoryName: null, categorySlug: null, posts: [] };

let repo = await gql({ owner, name, cursor: null });
result.repoId = repo.id;

if (!repo.hasDiscussionsEnabled) {
  console.warn('Discussions are not enabled on this repo yet — publishing an empty blog.');
} else {
  const cat = categorySlugs.map(sl => repo.discussionCategories.nodes.find(c => c.slug === sl)).find(Boolean);
  if (!cat) {
    console.warn(`No Discussions category matching "${categorySlugs.join(', ')}" — publishing an empty blog.`);
  } else {
    result.categoryId = cat.id;
    result.categoryName = cat.name;
    result.categorySlug = categorySlug = cat.slug;
    console.log(`Using Discussions category "${cat.name}"`);
    for (;;) {
      for (const d of repo.discussions.nodes) {
        if (d.category?.slug !== categorySlug) continue;
        result.posts.push({
          number: d.number,
          title: d.title,
          html: d.bodyHTML,
          excerpt: excerpt(d.bodyText),
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
          url: d.url,
          comments: d.comments.totalCount,
          author: d.author ? { login: d.author.login, url: d.author.url, avatar: d.author.avatarUrl } : null
        });
      }
      if (!repo.discussions.pageInfo.hasNextPage) break;
      repo = await gql({ owner, name, cursor: repo.discussions.pageInfo.endCursor });
    }
  }
}

await writeFile(out, JSON.stringify(result, null, 2));
console.log(`Wrote ${result.posts.length} post(s) to ${out}`);
