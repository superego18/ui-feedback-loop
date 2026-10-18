#!/usr/bin/env node
// 비교 페이지와 대화창을 한 서버(한 주소)로 띄운다. 의존성 없음 (Node 18+).
// 사용: node review-server.mjs [--dir .ui-feedback] [--port 4799] [--lan]
//   --lan: 폰 등 다른 기기에서도 열리게 한다(접속 키 필요, lan-auth.mjs).
// 두 기능은 서브모듈에 있다: 대화창은 vendor/agent-chat-widget, 비교 페이지는 vendor/ui-review-page.
// 여기서는 둘의 요청 처리기를 한 서버에 붙이고, 비교 페이지에서 평가 완료를 표시하면 그 요약을 반영할 세션의 대화에 남기고 세션을 깨운다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { lanAuth } from '../vendor/agent-chat-widget/scripts/lan-auth.mjs';
import { createChatHandler } from '../vendor/agent-chat-widget/scripts/chat-handler.mjs';
import { createReviewHandler } from '../vendor/ui-review-page/scripts/review-handler.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
const root = path.resolve(arg('dir', '.ui-feedback'));
const port = Number(arg('port', '4799'));
if (!fs.existsSync(path.join(root, 'review.html'))) {
  console.error(`review.html 이 없습니다: ${root}`);
  process.exit(1);
}
const auth = lanAuth({ dir: root, lan: process.argv.includes('--lan') });
const chat = createChatHandler({ root, auth });
const review = createReviewHandler({
  root,
  // 평가 완료: 어느 페이지에서 평가했든 대화창에서 보이고, 그 세션의 대화 감시가 받는다. Codex 세션은 바로 깨운다.
  onDone: ({ round, summary, session }) => {
    const reviewer = chat.findSessionByKey(session);
    if (!reviewer) return;
    const file = path.join(root, `r${round}.json`);
    const footer = `(.ui-feedback/r${round}.json)`;
    const locatedSummary = summary.endsWith(footer) ? `${summary.slice(0, -footer.length)}(${file})` : summary;
    const text = [
      `피드백 확인해. 사용자가 ${round}차 비교 페이지에서 평가 완료를 표시했습니다. ${JSON.stringify(file)} 을 읽고 ui-feedback-loop 5단계대로 반영하세요.`,
      `평가와 상관없이 모든 항목의 memo, 이미지 핀 pins, 전체 의견 overall을 읽고 요청을 반영하고 질문에 답하세요. ${JSON.stringify(path.join(root, 'chat.json'))}와 ${JSON.stringify(path.join(root, 'requests.md'))}에서 이번 라운드 요청도 확인하세요.`,
      locatedSummary,
    ].join('\n\n');
    chat.addChat({ from: 'user', to: reviewer.sessionId, context: 'review', round, keepUnread: true, text });
  },
});

const server = http.createServer((req, res) => {
  if (!auth.check(req, res)) return;
  const url = new URL(req.url, 'http://localhost');
  // 위젯은 /__uifb/api/* 로 부르므로 앞의 /__uifb 를 떼고 같은 API 로 처리한다.
  if (url.pathname.startsWith('/__uifb/api/')) url.pathname = url.pathname.slice('/__uifb'.length);
  // 대화창이 먼저(자기 주소만 맡음), 비교 페이지가 나머지(페이지·이미지 파일과 없는 주소의 404)를 맡는다.
  if (chat.handle(req, res, url)) return;
  review.handle(req, res, url);
});
server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `포트 ${port} 이(가) 이미 쓰이고 있습니다. --port 로 바꾸세요.` : err.message);
  process.exit(1);
});
server.listen(port, auth.host, () => {
  console.log(`비교 페이지: http://localhost:${port}/`);
  for (const u of auth.urls(port)) console.log(`다른 기기(폰)에서: ${u}`);
  console.log(`평가 저장 위치: ${root}${path.sep}r<round>.json`);
});
