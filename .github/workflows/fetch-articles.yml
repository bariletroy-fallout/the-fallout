const RSSParser = require('rss-parser');
const TurndownService = require('turndown');
const fs = require('fs');
const path = require('path');

const parser = new RSSParser();
const turndown = new TurndownService();

async function main() {
  console.log('Fetching Substack RSS...');
  const feed = await parser.parseURL('https://thefalloutwithtbs.substack.com/feed');

  if (!fs.existsSync('articles')) fs.mkdirSync('articles');

  const index = [];

  for (const item of feed.items) {
    const date = new Date(item.pubDate).toISOString().split('T')[0];
    const slug = item.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);

    const filename = date + '-' + slug + '.md';
    const filepath = path.join('articles', filename);

    const content = item['content:encoded'] || item.content || item.contentSnippet || '';
    const markdown = turndown.turndown(content);

    const frontmatter = [
      '---',
      'title: "' + item.title.replace(/"/g, '\\"') + '"',
      'date: "' + date + '"',
      'link: "' + item.link + '"',
      '---',
      '',
      ''
    ].join('\n');

    fs.writeFileSync(filepath, frontmatter + markdown);
    console.log('Wrote:', filename);

    index.push({
      title: item.title,
      date: date,
      slug: slug,
      filename: filename,
      link: item.link,
      excerpt: item.contentSnippet ? item.contentSnippet.slice(0, 200) : ''
    });
  }

  fs.writeFileSync('articles/index.json', JSON.stringify(index, null, 2));
  console.log('Done! Wrote', index.length, 'articles');
}

main().catch(function(err) {
  console.error(err);
  process.exit(1);
});
