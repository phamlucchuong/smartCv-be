const cloudscraper = require('cloudscraper');

async function main() {
  const url = process.argv[2] || 'https://www.topcv.vn/cong-ty';
  const body = await cloudscraper.get({
    url,
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  console.log(body.slice(0, 4000));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
