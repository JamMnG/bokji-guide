const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const API_KEY = process.env.DATA_GO_KR_SERVICE_KEY;
const LIST_API = 'https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001';
const DETAIL_API = 'https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfaredetailedV001';

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

async function readFileSafe(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

async function proxyToDataGoKr(targetUrl, res) {
  if (!API_KEY) {
    send(res, 500, 'DATA_GO_KR_SERVICE_KEY 환경변수가 설정되지 않았습니다.', {
      'Content-Type': 'text/plain; charset=UTF-8',
    });
    return;
  }

  const response = await fetch(targetUrl, {
    headers: {
      Accept: 'application/xml',
    },
  });

  const body = await response.text();
  send(res, response.status, body, {
    'Content-Type': response.headers.get('content-type') || 'application/xml; charset=UTF-8',
  });
}

function buildListUrl(requestUrl) {
  const params = new URLSearchParams({
    serviceKey: API_KEY,
    callTp: 'L',
    pageNo: requestUrl.searchParams.get('pageNo') || '1',
    numOfRows: requestUrl.searchParams.get('numOfRows') || '500',
    srchKeyCode: requestUrl.searchParams.get('srchKeyCode') || '003',
    orderBy: requestUrl.searchParams.get('orderBy') || 'date',
  });

  const searchWrd = requestUrl.searchParams.get('searchWrd');
  if (searchWrd) params.set('searchWrd', searchWrd);

  const lifeArray = requestUrl.searchParams.get('lifeArray');
  if (lifeArray && lifeArray !== '전체') params.set('lifeArray', lifeArray);

  const trgterIndvdlArray = requestUrl.searchParams.get('trgterIndvdlArray');
  if (trgterIndvdlArray) params.set('trgterIndvdlArray', trgterIndvdlArray);

  const intrsThemaArray = requestUrl.searchParams.get('intrsThemaArray');
  if (intrsThemaArray) params.set('intrsThemaArray', intrsThemaArray);

  const age = requestUrl.searchParams.get('age');
  if (age) params.set('age', age);

  const onapPsbltYn = requestUrl.searchParams.get('onapPsbltYn');
  if (onapPsbltYn) params.set('onapPsbltYn', onapPsbltYn);

  return `${LIST_API}?${params.toString()}`;
}

function buildDetailUrl(requestUrl) {
  const servId = requestUrl.searchParams.get('servId');
  const params = new URLSearchParams({
    serviceKey: API_KEY,
    callTp: 'D',
    servId: servId || '',
  });

  return `${DETAIL_API}?${params.toString()}`;
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (requestUrl.pathname === '/api/welfare/list') {
      return proxyToDataGoKr(buildListUrl(requestUrl), res);
    }

    if (requestUrl.pathname === '/api/welfare/detail') {
      return proxyToDataGoKr(buildDetailUrl(requestUrl), res);
    }

    const filePath = requestUrl.pathname === '/'
      ? path.join(ROOT, 'index.html')
      : path.join(ROOT, requestUrl.pathname);

    const file = await readFileSafe(filePath);
    if (file) {
      const contentType = requestUrl.pathname.endsWith('.js')
        ? 'application/javascript; charset=UTF-8'
        : requestUrl.pathname.endsWith('.css')
          ? 'text/css; charset=UTF-8'
          : 'text/html; charset=UTF-8';
      return send(res, 200, file, { 'Content-Type': contentType });
    }

    send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=UTF-8' });
  } catch (error) {
    send(res, 500, String(error?.stack || error), { 'Content-Type': 'text/plain; charset=UTF-8' });
  }
});

server.listen(PORT, () => {
  console.log(`복지길잡이 서버 실행 중: http://localhost:${PORT}/`);
});
